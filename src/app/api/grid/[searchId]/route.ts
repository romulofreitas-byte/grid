import { NextResponse } from "next/server";
import { getSearchForUser } from "@/lib/auth/search-access";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getBalance } from "@/lib/billing/service";
import { redactGridRows } from "@/lib/billing/redact";
import { getRepo } from "@/lib/data";

export const maxDuration = 60;

function isPgTimeout(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      String((err as { code: unknown }).code) === "57014",
  );
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ searchId: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  try {
    const { searchId } = await ctx.params;
    const search = await getSearchForUser(gated.userId, searchId);
    if (!search) {
      return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
    }
    const { searchParams } = new URL(req.url);
    if (searchParams.get("unauditedIds") === "1") {
      const cnpjs = await getRepo().listUnauditedCnpjs(searchId);
      return NextResponse.json({ cnpjs });
    }
    const cursor = Number(searchParams.get("cursor") ?? "0");
    const limit = Number(searchParams.get("limit") ?? "50");
    const result = await getRepo().listGridRows(searchId, cursor, limit);
    const balance = await getBalance(gated.userId);
    return NextResponse.json({
      ...result,
      rows: redactGridRows(result.rows, balance.enrichAllowed),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Não foi possível carregar o grid" },
      { status: isPgTimeout(err) ? 504 : 500 },
    );
  }
}
