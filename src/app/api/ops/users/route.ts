import { NextResponse } from "next/server";
import { guardOpsApi } from "@/lib/auth/api-guard";
import { parseOpsUserListParams } from "@/lib/ops/filters";
import { listOpsUsers, OpsDataError } from "@/lib/ops/metrics";

export async function GET(req: Request) {
  const gated = await guardOpsApi(req, "read");
  if (gated instanceof NextResponse) return gated;
  const { filters, q, limit, offset, sort } = parseOpsUserListParams(
    new URL(req.url).searchParams,
  );
  try {
    return NextResponse.json(
      await listOpsUsers({ q, filters, limit, offset, sort }),
    );
  } catch (err) {
    if (err instanceof OpsDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Não foi possível listar os usuários" },
      { status: 500 },
    );
  }
}
