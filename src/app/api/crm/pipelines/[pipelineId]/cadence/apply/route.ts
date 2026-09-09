import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ pipelineId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { pipelineId } = await ctx.params;
  const result = await getRepo().applyCrmCadenceToOthers(
    gated.userId,
    pipelineId,
  );
  if (!result) return jsonError("Pista não encontrada.", 404);
  return NextResponse.json(result);
}
