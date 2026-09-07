import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { pipelineDeleteSchema, pipelinePatchSchema } from "@/lib/crm/schema";
import { executePipelineRemoval } from "@/lib/crm/pipeline-removal";

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
  const parsed = pipelineDeleteSchema.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return jsonError("Payload inválido.");
  const result = await executePipelineRemoval(
    getRepo(),
    gated.userId,
    pipelineId,
    parsed.data.transferToPipelineId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, preview: result.preview },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true, pipelines: result.pipelines });
}
