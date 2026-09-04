import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError } from "@/app/api/crm/_http";
import { countConfirmedCrmCall } from "@/lib/crm/record-call";
import { getRepo } from "@/lib/data";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const repo = getRepo();
  const result = await repo.completeCrmActivity(gated.userId, dealId);
  if (!result) return jsonError("Negócio não encontrado.", 404);
  if (!result.event) return jsonError("Nenhuma atividade a concluir.");
  await countConfirmedCrmCall(
    repo,
    gated.userId,
    result.deal,
    result.event.kind,
  );
  return NextResponse.json(result);
}
