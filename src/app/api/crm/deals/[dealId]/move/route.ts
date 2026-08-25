import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { dealMoveSchema } from "@/lib/crm/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const parsed = dealMoveSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Movimento inválido.");
  const deal = await getRepo().moveCrmDeal(
    gated.userId,
    dealId,
    parsed.data.stageId,
    parsed.data.position,
  );
  if (!deal) return jsonError("Não foi possível mover o card.", 404);
  return NextResponse.json({ deal });
}
