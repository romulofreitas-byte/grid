import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardAutomationsApi, jsonError, readJson } from "@/app/api/crm/_http";
import {
  generateInboundToken,
  hashInboundToken,
  inboundLeadsUrl,
  publicRequestOrigin,
} from "@/lib/crm/inbound-token";
import { crmInboundCreateSchema } from "@/lib/crm/schema";
import {
  AUTOMATION_LIMIT,
  type CrmInboundEndpoint,
} from "@/lib/crm/types";
import {
  toPublicInboundLastEvent,
  type PublicInboundLastEvent,
} from "@/lib/crm/inbound-events";
import { getRepo } from "@/lib/data";

function publicEndpoint(
  row: CrmInboundEndpoint,
  origin: string,
  lastEvent: PublicInboundLastEvent | null,
) {
  return {
    id: row.id,
    nome: row.nome,
    pipeline_id: row.pipeline_id,
    stage_id: row.stage_id,
    lead_kind: row.lead_kind,
    channel: row.channel,
    created_at: row.created_at,
    updated_at: row.updated_at,
    url: inboundLeadsUrl(origin, row.id),
    last_event: lastEvent,
  };
}

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
      publicEndpoint(row, origin, lastById.get(row.id) ?? null),
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
    return jsonError(
      "Apague uma campanha parada ou fale com a gente.",
      400,
    );
  }
  const token = generateInboundToken();
  const endpoint = await repo.createCrmInboundEndpoint(gated.userId, {
    nome: parsed.data.nome,
    pipelineId: parsed.data.pipeline_id,
    stage_id: parsed.data.stage_id ?? null,
    lead_kind: parsed.data.lead_kind,
    channel: parsed.data.channel,
    token_hash: hashInboundToken(token),
  });
  if (!endpoint) {
    return jsonError(
      "Não foi possível salvar. Confira o nicho ou rode a migration de automações.",
      404,
    );
  }
  const origin = publicRequestOrigin(req);
  return NextResponse.json({
    endpoint: publicEndpoint(endpoint, origin, null),
    token,
  });
}
