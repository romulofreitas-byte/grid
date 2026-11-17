import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ dealId: string; activityId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId, activityId } = await ctx.params;
  const deal = await getRepo().deleteCrmActivity(
    gated.userId,
    dealId,
    activityId,
  );
  if (!deal) return jsonError("Não foi possível excluir a ação.", 404);
  return NextResponse.json({ deal });
}
