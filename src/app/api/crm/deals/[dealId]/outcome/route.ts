import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { outcomeSchema } from "@/lib/crm/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const parsed = outcomeSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Payload inválido.");
  const result = await getRepo().setCrmDealOutcome(
    gated.userId,
    dealId,
    parsed.data.outcome,
  );
  if (!result) return jsonError("Negócio não encontrado.", 404);
  return NextResponse.json(result);
}
