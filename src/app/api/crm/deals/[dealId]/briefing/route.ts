import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError } from "@/app/api/crm/_http";
import { loadCrmBriefing, withoutHiddenBriefingPhones } from "@/lib/crm/briefing";
import { getBillingStore } from "@/lib/billing/service";
import { getRepo } from "@/lib/data";
import { cnpjKey } from "@/lib/hidden-phones";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const repo = getRepo();
  const deal = await repo.getCrmDeal(gated.userId, dealId);
  if (!deal) return jsonError("Negócio não encontrado.", 404);
  const digits = (deal.cnpj ?? "").replace(/\D/g, "").padStart(14, "0");
  const billed =
    digits.replace(/0/g, "").length > 0
      ? await (await getBillingStore()).isCnpjBilled(gated.userId, digits, "enrich")
      : false;
  const briefing = await loadCrmBriefing(
    deal,
    (cnpj) => repo.getCrmBriefingLookup(cnpj),
    { billed },
  );
  const company = cnpjKey(deal.cnpj);
  const hidden = company
    ? ((await repo.listHiddenPhones(gated.userId, [company])).get(company) ?? [])
    : [];
  return NextResponse.json({
    briefing: withoutHiddenBriefingPhones(briefing, hidden),
  });
}
