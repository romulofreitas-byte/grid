import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { stageDeleteSchema, stagePatchSchema } from "@/lib/crm/schema";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ stageId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { stageId } = await ctx.params;
  const parsed = stagePatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Payload inválido.");
  const stage = await getRepo().updateCrmStage(gated.userId, stageId, parsed.data);
  if (!stage) return jsonError("Faixa não encontrada.", 404);
  return NextResponse.json({ stage });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ stageId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { stageId } = await ctx.params;
  const parsed = stageDeleteSchema.safeParse(await readJson(req));
  const moveToStageId = parsed.success ? parsed.data.moveToStageId : undefined;
  const ok = await getRepo().deleteCrmStage(
    gated.userId,
    stageId,
    moveToStageId,
  );
  if (!ok) {
    return jsonError(
      "Escolha outra faixa para os negócios, ou deixe pelo menos uma faixa.",
    );
  }
  return NextResponse.json({ ok: true });
}
