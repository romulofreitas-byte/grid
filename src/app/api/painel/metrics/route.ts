import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { parsePainelFilters } from "@/lib/painel/filters";
import { loadPainelMetrics, PainelDataError } from "@/lib/painel/metrics";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const filters = parsePainelFilters(new URL(req.url).searchParams);
  try {
    return NextResponse.json(await loadPainelMetrics(gated.userId, filters));
  } catch (err) {
    if (err instanceof PainelDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Não foi possível carregar os números" },
      { status: 500 },
    );
  }
}
