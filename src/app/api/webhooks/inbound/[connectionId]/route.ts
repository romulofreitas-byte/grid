import { NextResponse } from "next/server";
import { guardPublicApi } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { decryptJson } from "@/lib/integrations/crypto";
import {
  GRID_SIGNATURE_HEADER,
  GRID_TIMESTAMP_HEADER,
  verifyGridWebhook,
} from "@/lib/integrations/hmac";
import { ingestCallOutcome } from "@/lib/integrations/ingest-outcome";
import { parseInboundOutcome } from "@/lib/integrations/outcomes";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ connectionId: string }> },
) {
  const limited = await guardPublicApi(req, "webhook");
  if (limited) return limited;

  const { connectionId } = await ctx.params;
  const rawBody = await req.text();
  const repo = getRepo();
  const connection = await repo.getIntegrationConnection(connectionId);
  if (!connection || connection.status !== "active") {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }

  let secret: string;
  try {
    secret = decryptJson(
      connection.credentials_ciphertext,
      connection.credentials_nonce,
    ).hmac_secret;
    if (!secret) {
      return NextResponse.json({ error: "Conexão inválida" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Conexão inválida" }, { status: 401 });
  }

  const verified = verifyGridWebhook({
    secret,
    rawBody,
    signatureHeader: req.headers.get(GRID_SIGNATURE_HEADER),
    timestampHeader: req.headers.get(GRID_TIMESTAMP_HEADER),
  });
  if (!verified.ok) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseInboundOutcome(json);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const result = await ingestCallOutcome({
    connection,
    eventType: parsed.body.event,
    cnpj: parsed.body.cnpj,
    e164: parsed.body.e164,
    disposition: parsed.body.disposition,
    notes: parsed.body.notes,
    durationSec: parsed.body.duration_sec,
    externalId: parsed.body.external_id,
  });
  return NextResponse.json(result);
}
