import { NextResponse } from "next/server";
import { guardPublicApi } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { decryptJson } from "@/lib/integrations/crypto";
import {
  GRID_SIGNATURE_HEADER,
  GRID_TIMESTAMP_HEADER,
  verifyGridWebhook,
} from "@/lib/integrations/hmac";
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

  const notes = parsed.body.notes;
  const lead = await repo.findSavedLeadForOutcome(connection.user_id, {
    cnpj: parsed.body.cnpj,
    e164: parsed.body.e164,
  });

  if (lead && parsed.status) {
    await repo.updateLead(lead.id, {
      status: parsed.status,
      notas: notes,
    });
  }

  await repo.insertIntegrationEvent({
    user_id: connection.user_id,
    connection_id: connection.id,
    job_id: null,
    direction: "inbound",
    event_type: parsed.body.event,
    cnpj: parsed.body.cnpj ?? lead?.cnpj ?? null,
    e164: parsed.body.e164 ?? null,
    external_id: parsed.body.external_id ?? null,
    disposition: parsed.body.disposition,
    lead_status: parsed.status,
    payload_summary: {
      duration_sec: parsed.body.duration_sec ?? null,
      matched: Boolean(lead),
    },
  });

  return NextResponse.json({
    ok: true,
    status: parsed.status,
    matched: Boolean(lead),
  });
}
