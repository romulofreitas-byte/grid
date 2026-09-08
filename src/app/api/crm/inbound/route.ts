import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardAutomationsApi, jsonError, readJson } from "@/app/api/crm/_http";
import { parseFormFields } from "@/lib/crm/form-fields";
import {
  generateInboundToken,
  hashInboundToken,
  publicRequestOrigin,
} from "@/lib/crm/inbound-token";
import { publicCampaign } from "@/lib/crm/public-campaign";
import { crmInboundCreateSchema } from "@/lib/crm/schema";
import { AUTOMATION_LIMIT } from "@/lib/crm/types";
import { toPublicInboundLastEvent } from "@/lib/crm/inbound-events";
import { getRepo } from "@/lib/data";

export async function GET(req: Request) {
  const gated = await guardAutomationsApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const origin = publicRequestOrigin(req);
  const repo = getRepo();
  const [endpoints, lasts] = await Promise.all([
    repo.listCrmInboundEndpoints(gated.userId),
    repo.listCrmInboundLastEvents(gated.userId),
  ]);
  const lastById = new Map(
    lasts.map((row) => [row.endpoint_id, toPublicInboundLastEvent(row)]),
  );
  return NextResponse.json({
    endpoints: endpoints.map((row) =>
      publicCampaign(row, origin, {
        lastEvent: lastById.get(row.id) ?? null,
      }),
    ),
    limit: AUTOMATION_LIMIT,
  });
}

export async function POST(req: Request) {
  const gated = await guardAutomationsApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const parsed = crmInboundCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Preencha nome, nicho e o tipo de lead.");
  const repo = getRepo();
  const existing = await repo.listCrmInboundEndpoints(gated.userId);
  if (existing.length >= AUTOMATION_LIMIT) {
    return jsonError("Apague uma campanha parada ou fale com a gente.", 400);
  }
  if (parsed.data.channel === "meta" && !parsed.data.meta_connection_id) {
    return jsonError("Conecte uma Página do Meta para esta campanha.");
  }
  const token = generateInboundToken();
  const publicToken =
    parsed.data.channel === "site" ? generateInboundToken() : null;
  const endpoint = await repo.createCrmInboundEndpoint(gated.userId, {
    nome: parsed.data.nome,
    pipelineId: parsed.data.pipeline_id,
    stage_id: parsed.data.stage_id ?? null,
    lead_kind: parsed.data.lead_kind,
    channel: parsed.data.channel,
    token_hash: hashInboundToken(token),
    public_token_hash: publicToken ? hashInboundToken(publicToken) : null,
    form_fields: parseFormFields(parsed.data.form_fields),
    meta_connection_id: parsed.data.meta_connection_id ?? null,
    meta_form_id: parsed.data.meta_form_id ?? null,
  });
  if (!endpoint) {
    return jsonError(
      "Não foi possível salvar. Confira o nicho ou rode a migration de automações.",
      404,
    );
  }
  const origin = publicRequestOrigin(req);
  return NextResponse.json({
    endpoint: publicCampaign(endpoint, origin, { publicToken }),
    token:
      parsed.data.channel === "webhook" || parsed.data.channel === "ads"
        ? token
        : null,
    public_token: publicToken,
  });
}
