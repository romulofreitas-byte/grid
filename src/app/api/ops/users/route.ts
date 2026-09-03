import { NextResponse } from "next/server";
import { guardOpsApi } from "@/lib/auth/api-guard";
import { listOpsUsers, OpsDataError } from "@/lib/ops/metrics";

export async function GET(req: Request) {
  const gated = await guardOpsApi(req, "read");
  if (gated instanceof NextResponse) return gated;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ users: await listOpsUsers(q) });
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
