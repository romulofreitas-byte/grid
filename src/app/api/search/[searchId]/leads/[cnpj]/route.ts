import { NextResponse } from "next/server";
import { getSearchForUser } from "@/lib/auth/search-access";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { digitsCnpj } from "@/lib/crm/bridge";
import { getRepo } from "@/lib/data";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ searchId: string; cnpj: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { searchId, cnpj } = await ctx.params;
  const owned = await getSearchForUser(gated.userId, searchId);
  if (!owned) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  const ok = await getRepo().deleteSavedLead(searchId, digitsCnpj(cnpj));
  if (!ok) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
