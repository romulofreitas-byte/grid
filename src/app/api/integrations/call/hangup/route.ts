import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import type { ConnectionCtx } from "@/lib/integrations/adapter";
import { adapterFor, canHangup } from "@/lib/integrations/adapter-registry";
import { decryptJson } from "@/lib/integrations/crypto";

const schema = z.object({
  connectionId: z.string().uuid(),
  externalId: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const connection = await getRepo().getIntegrationConnection(parsed.data.connectionId);
  if (!connection || connection.user_id !== gated.userId || connection.status !== "active") {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }
  if (!canHangup(connection.provider)) {
    return NextResponse.json(
      { error: "Esta conexão não desliga pelo GRID." },
      { status: 400 },
    );
  }

  const adapter = adapterFor(connection.provider);
  const ctx: ConnectionCtx = {
    connectionId: connection.id,
    userId: connection.user_id,
    provider: connection.provider,
    kind: connection.kind,
    config: connection.config,
    callerId: connection.caller_id,
    decryptCredentials: async () =>
      decryptJson(connection.credentials_ciphertext, connection.credentials_nonce),
  };

  try {
    await adapter.hangup!(parsed.data.externalId, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível desligar";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
