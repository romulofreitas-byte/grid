import { NextResponse } from "next/server";
import { guardOpsApi } from "@/lib/auth/api-guard";
import { opsGrantPlan } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { getOpsUser, isOpsProfileId } from "@/lib/ops/metrics";

function parsePlanBody(raw: unknown): "piloto" | "piloto_pro" | null {
  if (!raw || typeof raw !== "object") return null;
  const sku = (raw as { sku?: unknown }).sku;
  if (sku === "piloto" || sku === "piloto_pro") return sku;
  return null;
}

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
  let sku: ReturnType<typeof parsePlanBody> = null;
  try {
    sku = parsePlanBody(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (!sku) {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
  }
  try {
    await opsGrantPlan(id, sku);
    const user = await getOpsUser(id);
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Não foi possível liberar o plano" },
      { status: 400 },
    );
  }
}
