import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { stageCreateSchema } from "@/lib/crm/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ pipelineId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { pipelineId } = await ctx.params;
  const parsed = stageCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Dê um nome à etapa.");
  const stage = await getRepo().createCrmStage(
    gated.userId,
    pipelineId,
    parsed.data.nome,
  );
  if (!stage) return jsonError("Pista não encontrada.", 404);
  return NextResponse.json({ stage });
}
