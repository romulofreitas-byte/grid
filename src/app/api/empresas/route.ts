import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getBalance } from "@/lib/billing/service";
import { redactCompanySearchHits } from "@/lib/billing/redact";
import { COMPANY_SEARCH_LIMIT } from "@/lib/data/company-search";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";

export const maxDuration = 15;

export async function GET(req: Request) {
  const gated = await guardApi(req, "search");
  if (isGuardReject(gated)) return gated;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const ufs = (searchParams.get("ufs") ?? "")
    .split(",")
    .map((u) => u.trim().toUpperCase())
    .filter(Boolean);
  const soMatrizRaw = (searchParams.get("soMatriz") ?? "").toLowerCase();
  const soMatriz = soMatrizRaw === "1" || soMatrizRaw === "true";
  const repo = getRepo();
  try {
    const [hits, balance] = await Promise.all([
      repo.searchCompanies(q, { ufs, soMatriz, limit: COMPANY_SEARCH_LIMIT }),
      getBalance(gated.userId),
    ]);
    return NextResponse.json(redactCompanySearchHits(hits, balance.enrichAllowed));
  } catch (err) {
    return dbUnavailableResponse(err, "empresas_search");
  }
}
