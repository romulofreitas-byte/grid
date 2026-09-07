import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { dealTransferSchema } from "@/lib/crm/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const parsed = dealTransferSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Transferência inválida.");
  const result = await getRepo().transferCrmDeal(
    gated.userId,
    dealId,
    parsed.data.pipelineId,
  );
  if (!result) return jsonError("Não foi possível transferir o negócio.", 404);
  return NextResponse.json(result);
}
