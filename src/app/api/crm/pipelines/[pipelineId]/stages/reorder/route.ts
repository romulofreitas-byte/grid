import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { stageReorderSchema } from "@/lib/crm/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ pipelineId: string }> },
) {
  const gated = await guardApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { pipelineId } = await ctx.params;
  const parsed = stageReorderSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Cadência inválida.");
  const ok = await getRepo().reorderCrmStages(
    gated.userId,
    pipelineId,
    parsed.data.stageIds,
  );
  if (!ok) return jsonError("Não foi possível reordenar as faixas.", 400);
  const board = await getRepo().getCrmBoard(gated.userId, pipelineId);
  return NextResponse.json({ board });
}
