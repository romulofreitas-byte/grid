import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { decryptJson } from "@/lib/integrations/crypto";
import { lookupApi4comCallEnded } from "@/lib/integrations/api4com-recording";
import type { IntegrationConnectionRecord } from "@/lib/integrations/records";

const schema = z.object({
  connectionId: z.string().uuid(),
  externalId: z.string().min(1).max(120),
  callRef: z.string().min(1).max(80).optional(),
});

async function api4comCallEnded(
  connection: IntegrationConnectionRecord,
  vendorId: string,
  callRef: string | null,
): Promise<boolean> {
  try {
    const creds = await decryptJson(
      connection.credentials_ciphertext,
      connection.credentials_nonce,
    );
    const token = creds.token?.trim() ?? "";
    if (!token) return false;
    return await lookupApi4comCallEnded(token, { vendorId, callRef });
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;

  const url = new URL(req.url);
  const callRef = url.searchParams.get("callRef");
  const parsed = schema.safeParse({
    connectionId: url.searchParams.get("connectionId"),
    externalId: url.searchParams.get("externalId"),
    callRef: callRef?.trim() || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const repo = getRepo();
  const connection = await repo.getIntegrationConnection(parsed.data.connectionId);
  if (!connection || connection.user_id !== gated.userId) {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }

  const callRefValue = parsed.data.callRef ?? null;
  let ended = await repo.hasInboundCallOutcome(
    gated.userId,
    connection.id,
    parsed.data.externalId,
    callRefValue,
  );
  if (!ended && connection.provider === "api4com") {
    ended = await api4comCallEnded(
      connection,
      parsed.data.externalId,
      callRefValue,
    );
  }
  return NextResponse.json({ ended });
}
