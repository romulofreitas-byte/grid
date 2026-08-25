import { NextResponse } from "next/server";
import { guardPublicApi } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { adapterFor } from "@/lib/integrations/adapter-registry";
import { decryptJson } from "@/lib/integrations/crypto";
import { ingestCallOutcome } from "@/lib/integrations/ingest-outcome";
import { isLiveVoipId } from "@/lib/integrations/catalog";
import { isNativeVoipProvider } from "@/lib/integrations/voip-setup";
import type { ConnectionCtx } from "@/lib/integrations/adapter";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ catalogId: string; connectionId: string }> },
) {
  const limited = await guardPublicApi(req, "webhook");
  if (limited) return limited;

  const { catalogId, connectionId } = await ctx.params;
  if (!isLiveVoipId(catalogId)) {
    return NextResponse.json({ error: "VoIP inválido" }, { status: 404 });
  }

  const rawBody = await req.text();
  const repo = getRepo();
  const connection = await repo.getIntegrationConnection(connectionId);
  if (!connection || connection.status !== "active") {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }
  if (
    !isNativeVoipProvider(connection.provider) ||
    (connection.provider !== catalogId &&
      connection.config.catalog_id !== catalogId)
  ) {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }

  const adapter = adapterFor(connection.provider);
  const adapterCtx: ConnectionCtx = {
    connectionId: connection.id,
    userId: connection.user_id,
    provider: connection.provider,
    kind: connection.kind,
    config: connection.config,
    callerId: connection.caller_id,
    decryptCredentials: async () =>
      decryptJson(connection.credentials_ciphertext, connection.credentials_nonce),
  };

  if (adapter.ackInbound) {
    try {
      await adapter.ackInbound(rawBody, adapterCtx);
    } catch (err) {
      const message = err instanceof Error ? err.message : "ack";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (!adapter.parseInbound) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let parsed;
  try {
    parsed = await adapter.parseInbound(req, rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  if (!parsed) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await ingestCallOutcome({
    connection,
    eventType: "call.outcome",
    cnpj: parsed.cnpj,
    e164: parsed.e164,
    disposition: parsed.disposition,
    notes: parsed.notes,
    durationSec: parsed.durationSec,
    externalId: parsed.externalId,
    forceStatus: "ligando",
  });
  return NextResponse.json(result);
}
