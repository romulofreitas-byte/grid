import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getBillingMe } from "@/lib/billing/service";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const me = await getBillingMe(gated.userId);
  return NextResponse.json(me);
}
