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
import { crmInboundPatchSchema } from "@/lib/crm/schema";
import { getRepo } from "@/lib/data";

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
  const publicToken = parsed.data.rotate_public ? generateInboundToken() : null;
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
      public_token_hash: publicToken ? hashInboundToken(publicToken) : undefined,
      form_fields: parsed.data.form_fields
        ? parseFormFields(parsed.data.form_fields)
        : undefined,
      meta_connection_id: parsed.data.meta_connection_id,
      meta_form_id: parsed.data.meta_form_id,
    },
  );
  if (!endpoint) return jsonError("Campanha não encontrada.", 404);
  return NextResponse.json({
    endpoint: publicCampaign(endpoint, publicRequestOrigin(req), {
      publicToken,
    }),
    token,
    public_token: publicToken,
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
