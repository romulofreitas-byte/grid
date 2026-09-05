import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import {
  generateInboundToken,
  hashInboundToken,
  inboundLeadsUrl,
  publicRequestOrigin,
} from "@/lib/crm/inbound-token";
import { crmInboundUpsertSchema } from "@/lib/crm/schema";
import type { CrmInboundEndpoint } from "@/lib/crm/types";
import { getRepo } from "@/lib/data";

function publicEndpoint(row: CrmInboundEndpoint) {
  return {
    id: row.id,
    pipeline_id: row.pipeline_id,
    stage_id: row.stage_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(req: Request) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const endpoint = await getRepo().getCrmInboundEndpoint(gated.userId);
  return NextResponse.json({
    endpoint: endpoint ? publicEndpoint(endpoint) : null,
    url: inboundLeadsUrl(publicRequestOrigin(req)),
  });
}

export async function POST(req: Request) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const parsed = crmInboundUpsertSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Escolha o nicho de destino.");
  const repo = getRepo();
  const existing = await repo.getCrmInboundEndpoint(gated.userId);
  const rotate = parsed.data.rotate === true || !existing;
  const token = rotate ? generateInboundToken() : null;
  const tokenHash = token
    ? hashInboundToken(token)
    : existing!.token_hash;
  const endpoint = await repo.upsertCrmInboundEndpoint(gated.userId, {
    pipelineId: parsed.data.pipeline_id,
    stage_id: parsed.data.stage_id ?? null,
    token_hash: tokenHash,
  });
  if (!endpoint) {
    return jsonError(
      "Não foi possível salvar. Confira o nicho ou rode a migration de importações.",
      404,
    );
  }
  return NextResponse.json({
    endpoint: publicEndpoint(endpoint),
    token,
    url: inboundLeadsUrl(publicRequestOrigin(req)),
  });
}
