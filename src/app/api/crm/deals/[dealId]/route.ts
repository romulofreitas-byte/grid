import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { dealPatchSchema } from "@/lib/crm/schema";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const parsed = dealPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Payload inválido.");
  const deal = await getRepo().updateCrmDeal(gated.userId, dealId, parsed.data);
  if (!deal) return jsonError("Negócio não encontrado.", 404);
  return NextResponse.json({ deal });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const ok = await getRepo().deleteCrmDeal(gated.userId, dealId);
  if (!ok) return jsonError("Negócio não encontrado.", 404);
  return NextResponse.json({ ok: true });
}
