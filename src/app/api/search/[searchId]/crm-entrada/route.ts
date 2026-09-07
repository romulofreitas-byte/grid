import { NextResponse } from "next/server";
import { getSearchForUser } from "@/lib/auth/search-access";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ searchId: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { searchId } = await ctx.params;
  const search = await getSearchForUser(gated.userId, searchId);
  if (!search) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  const entradaCount = await getRepo().countCrmEntradaDealsForSearch(
    gated.userId,
    searchId,
  );
  return NextResponse.json({ entradaCount });
}
