import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { pipelinePatchSchema } from "@/lib/crm/schema";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ pipelineId: string }> },
) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { pipelineId } = await ctx.params;
  const board = await getRepo().getCrmBoard(gated.userId, pipelineId);
  if (!board) return jsonError("Pista não encontrada.", 404);
  return NextResponse.json({ board });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ pipelineId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { pipelineId } = await ctx.params;
  const parsed = pipelinePatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Payload inválido.");
  const pipeline = await getRepo().updateCrmPipeline(
    gated.userId,
    pipelineId,
    parsed.data,
  );
  if (!pipeline) return jsonError("Pista não encontrada.", 404);
  return NextResponse.json({ pipeline });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ pipelineId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { pipelineId } = await ctx.params;
  const ok = await getRepo().deleteCrmPipeline(gated.userId, pipelineId);
  if (!ok) {
    return jsonError("Não dá para excluir o último nicho.", 400);
  }
  const pipelines = await getRepo().listCrmPipelines(gated.userId);
  return NextResponse.json({ ok: true, pipelines });
}
