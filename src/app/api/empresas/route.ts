import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { COMPANY_SEARCH_LIMIT } from "@/lib/data/company-search";
import { getRepo } from "@/lib/data";

export const maxDuration = 60;

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
  const hits = await repo.searchCompanies(q, { ufs, soMatriz, limit: COMPANY_SEARCH_LIMIT });
  return NextResponse.json(hits);
}
