import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { dealCreateSchema } from "@/lib/crm/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ pipelineId: string }> },
) {
  const gated = await guardApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { pipelineId } = await ctx.params;
  const parsed = dealCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Informe o nome da empresa.");
  const deal = await getRepo().createCrmDeal(gated.userId, {
    pipelineId,
    ...parsed.data,
  });
  if (!deal) return jsonError("Pista não encontrada.", 404);
  return NextResponse.json({ deal });
}
