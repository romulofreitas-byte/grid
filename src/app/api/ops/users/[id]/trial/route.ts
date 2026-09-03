import { NextResponse } from "next/server";
import { guardOpsApi } from "@/lib/auth/api-guard";
import { BillingError } from "@/lib/billing/types";
import { opsGrantPlatformTrial } from "@/lib/billing/service";
import { getOpsUser, isOpsProfileId } from "@/lib/ops/metrics";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardOpsApi(req, "write");
  if (gated instanceof NextResponse) return gated;
  const { id } = await ctx.params;
  if (!isOpsProfileId(id)) {
    return NextResponse.json({ error: "Usuário inválido" }, { status: 400 });
  }
  let force = false;
  try {
    const text = await req.text();
    if (text) {
      const body = JSON.parse(text) as { force?: unknown };
      force = body.force === true;
    }
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  try {
    await opsGrantPlatformTrial(id, { force });
    const user = await getOpsUser(id);
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Não foi possível liberar o trial" },
      { status: 400 },
    );
  }
}
