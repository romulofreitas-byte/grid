import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardAutomationsApi, jsonError, readJson } from "@/app/api/crm/_http";
import {
  generateInboundToken,
  hashInboundToken,
  inboundLeadsUrl,
  publicRequestOrigin,
} from "@/lib/crm/inbound-token";
import { crmInboundPatchSchema } from "@/lib/crm/schema";
import type { CrmInboundEndpoint } from "@/lib/crm/types";
import { getRepo } from "@/lib/data";

function publicEndpoint(
  row: CrmInboundEndpoint,
  origin: string,
  lastEvent: null = null,
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
  };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ endpointId: string }> },
) {
  const gated = await guardAutomationsApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { endpointId } = await ctx.params;
  const parsed = crmInboundPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Dados inválidos.");
  const token = parsed.data.rotate ? generateInboundToken() : null;
  const endpoint = await getRepo().updateCrmInboundEndpoint(
    gated.userId,
    endpointId,
    {
      nome: parsed.data.nome,
      pipelineId: parsed.data.pipeline_id,
      stage_id: parsed.data.stage_id,
      lead_kind: parsed.data.lead_kind,
      channel: parsed.data.channel,
      token_hash: token ? hashInboundToken(token) : undefined,
    },
  );
  if (!endpoint) return jsonError("Campanha não encontrada.", 404);
  return NextResponse.json({
    endpoint: publicEndpoint(endpoint, publicRequestOrigin(req)),
    token,
  });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ endpointId: string }> },
) {
  const gated = await guardAutomationsApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { endpointId } = await ctx.params;
  const ok = await getRepo().deleteCrmInboundEndpoint(gated.userId, endpointId);
  if (!ok) return jsonError("Campanha não encontrada.", 404);
  return NextResponse.json({ ok: true });
}
