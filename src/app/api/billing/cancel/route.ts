import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { BillingError } from "@/lib/billing/types";
import { cancelSubscription } from "@/lib/billing/service";

export async function POST(req: Request) {
  const gated = await guardApi(req, "billing");
  if (isGuardReject(gated)) return gated;
  try {
    await cancelSubscription(gated.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Não foi possível cancelar" }, { status: 400 });
  }
}
