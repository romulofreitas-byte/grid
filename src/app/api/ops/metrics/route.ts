import { NextResponse } from "next/server";
import { guardOpsApi } from "@/lib/auth/api-guard";
import { parseOpsDashboardFilters } from "@/lib/ops/filters";
import { loadOpsMetrics, OpsDataError } from "@/lib/ops/metrics";

export async function GET(req: Request) {
  const gated = await guardOpsApi(req, "read");
  if (gated instanceof NextResponse) return gated;
  const filters = parseOpsDashboardFilters(new URL(req.url).searchParams);
  try {
    return NextResponse.json(await loadOpsMetrics(filters));
  } catch (err) {
    if (err instanceof OpsDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Não foi possível carregar os números" },
      { status: 500 },
    );
  }
}
