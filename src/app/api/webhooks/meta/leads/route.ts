import { NextResponse } from "next/server";
import { ingestInboundJson } from "@/lib/crm/ingest-inbound";
import {
  metaAppSecret,
  metaWebhookVerifyToken,
  verifyMetaWebhookSignature,
} from "@/lib/crm/meta-api";
import {
  decryptPageToken,
  fetchMetaLead,
  mapMetaLeadToInbound,
  parseLeadgenPayload,
} from "@/lib/crm/meta-leads";
import { getRepo } from "@/lib/data";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = metaWebhookVerifyToken();
  if (mode === "subscribe" && expected && token && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verificação inválida" }, { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (metaAppSecret()) {
    const signature = req.headers.get("x-hub-signature-256");
    if (!verifyMetaWebhookSignature(raw, signature)) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
  }
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const changes = parseLeadgenPayload(body);
  const repo = getRepo();
  for (const change of changes) {
    const connection = await repo.getCrmMetaConnectionByPageId(change.pageId);
    if (!connection) continue;
    const endpoints = await repo.findCrmInboundEndpointsForMetaLead(
      change.pageId,
      change.formId,
    );
    if (endpoints.length === 0) continue;
    const pending = [];
    for (const endpoint of endpoints) {
      const prior = await repo.findCrmInboundEventByExternalId(
        endpoint.id,
        change.leadgenId,
      );
      if (prior?.deal_id) continue;
      pending.push(endpoint);
    }
    if (pending.length === 0) continue;
    let leadJson: Record<string, unknown>;
    try {
      const token = decryptPageToken(
        connection.credentials_ciphertext,
        connection.credentials_nonce,
      );
      const lead = await fetchMetaLead(token, change.leadgenId);
      leadJson = mapMetaLeadToInbound(lead);
    } catch (err) {
      console.error("meta_lead_fetch_error", change.leadgenId, err);
      continue;
    }
    for (const endpoint of pending) {
      await ingestInboundJson(endpoint, leadJson, { externalId: change.leadgenId });
    }
  }
  return NextResponse.json({ ok: true });
}
