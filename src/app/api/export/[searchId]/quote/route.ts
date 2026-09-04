import { NextResponse } from "next/server";
import { getSearchForUser } from "@/lib/auth/search-access";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { quoteExport } from "@/lib/billing/service";
import {
  EXPORT_NEEDS_QUALIFY,
  exportLimitForFormat,
  qualifiedLeadsForExport,
} from "@/lib/export/qualified";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ searchId: string }> },
) {
  const gated = await guardApi(req, "export");
  if (isGuardReject(gated)) return gated;
  const { searchId } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format");
  const search = await getSearchForUser(gated.userId, searchId);
  if (!search) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  const leads = await qualifiedLeadsForExport(
    gated.userId,
    searchId,
    exportLimitForFormat(format),
  );
  if (leads.length === 0) {
    return NextResponse.json({ error: EXPORT_NEEDS_QUALIFY }, { status: 400 });
  }
  const quote = await quoteExport(
    gated.userId,
    leads.map((lead) => lead.establishment.cnpj),
  );
  return NextResponse.json(quote);
}
