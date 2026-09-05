import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import type { RateBucket } from "@/lib/auth/rate-limit";
import { planRequiredPayload } from "@/lib/billing/paywall";
import { assertAutomationsAccess, assertCrmAccess } from "@/lib/billing/service";
import { AutomationsNotAllowedError, CrmNotAllowedError } from "@/lib/billing/types";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function crmDeniedResponse(err: CrmNotAllowedError): NextResponse {
  const trial = err.message.includes("30 dias");
  return NextResponse.json(
    planRequiredPayload(err.message, trial ? "trial_expired" : "plan_required"),
    { status: 403 },
  );
}

export async function guardCrmApi(
  req: Request,
  bucket: RateBucket,
): Promise<{ userId: string; email: string | null } | NextResponse> {
  const gated = await guardApi(req, bucket);
  if (isGuardReject(gated)) return gated;
  try {
    await assertCrmAccess(gated.userId);
  } catch (err) {
    if (err instanceof CrmNotAllowedError) return crmDeniedResponse(err);
    throw err;
  }
  return gated;
}

export function automationsDeniedResponse(
  err: AutomationsNotAllowedError,
): NextResponse {
  return NextResponse.json(planRequiredPayload(err.message), { status: 403 });
}

export async function guardAutomationsApi(
  req: Request,
  bucket: RateBucket,
): Promise<{ userId: string; email: string | null } | NextResponse> {
  const gated = await guardCrmApi(req, bucket);
  if (isGuardReject(gated)) return gated;
  try {
    await assertAutomationsAccess(gated.userId);
  } catch (err) {
    if (err instanceof AutomationsNotAllowedError) {
      return automationsDeniedResponse(err);
    }
    throw err;
  }
  return gated;
}
