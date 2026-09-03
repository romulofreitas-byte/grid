import { NextResponse } from "next/server";
import { guardOpsApi } from "@/lib/auth/api-guard";
import { getOpsUser, OpsDataError } from "@/lib/ops/metrics";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardOpsApi(req, "read");
  if (gated instanceof NextResponse) return gated;
  const { id } = await ctx.params;
  try {
    const user = await getOpsUser(id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof OpsDataError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Não foi possível abrir a ficha" },
      { status: 500 },
    );
  }
}
