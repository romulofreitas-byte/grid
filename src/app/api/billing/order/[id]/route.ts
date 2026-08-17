import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getOrderForProfile, simulateMockPayment } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardApi(req, "billing");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  const order = await getOrderForProfile(id, gated.userId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ order });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardApi(req, "billing");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "simulate") {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }
  try {
    const order = await simulateMockPayment(id, gated.userId);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Não foi possível confirmar" }, { status: 400 });
  }
}
