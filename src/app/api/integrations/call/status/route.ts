import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

const schema = z.object({
  connectionId: z.string().uuid(),
  externalId: z.string().min(1).max(120),
});

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;

  const url = new URL(req.url);
  const parsed = schema.safeParse({
    connectionId: url.searchParams.get("connectionId"),
    externalId: url.searchParams.get("externalId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const repo = getRepo();
  const connection = await repo.getIntegrationConnection(parsed.data.connectionId);
  if (!connection || connection.user_id !== gated.userId) {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }

  const ended = await repo.hasInboundCallOutcome(
    gated.userId,
    connection.id,
    parsed.data.externalId,
  );
  return NextResponse.json({ ended });
}
