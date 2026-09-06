import { NextResponse } from "next/server";
import { guardPublicApi } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { adapterFor } from "@/lib/integrations/adapter-registry";
import { isLiveDialerId } from "@/lib/integrations/catalog";
import { isNativeDialerProvider } from "@/lib/integrations/dialer-setup";
import { ingestCallOutcome } from "@/lib/integrations/ingest-outcome";

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
  if (!isLiveDialerId(catalogId)) {
    return NextResponse.json({ error: "Discador inválido" }, { status: 404 });
  }

  const rawBody = await req.text();
  const repo = getRepo();
  const connection = await repo.getIntegrationConnection(connectionId);
  if (!connection || connection.status !== "active") {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }
  if (
    !isNativeDialerProvider(connection.provider) ||
    (connection.provider !== catalogId &&
      connection.config.catalog_id !== catalogId)
  ) {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }

  const adapter = adapterFor(connection.provider);

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
  });
  return NextResponse.json(result);
}
