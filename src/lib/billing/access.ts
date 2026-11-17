import type { BillingSubscription } from "@/lib/billing/types";

export const PLATFORM_TRIAL_DAYS = 30;

export function addUtcDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function subscriptionPeriodOpen(
  sub: BillingSubscription | null | undefined,
  at = new Date(),
): boolean {
  if (!sub) return false;
  return new Date(sub.currentPeriodEnd).getTime() > at.getTime();
}

/** Paid cycle stays usable until currentPeriodEnd. past_due is dunning, not a lock. */
export function subscriptionGrantsAccess(
  sub: BillingSubscription | null | undefined,
  at = new Date(),
): boolean {
  if (!sub) return false;
  if (!subscriptionPeriodOpen(sub, at)) return false;
  if (sub.status === "canceled") return false;
  return (
    sub.status === "active" ||
    sub.status === "trialing" ||
    sub.status === "past_due"
  );
}

export function trialDaysRemaining(
  sub: BillingSubscription | null | undefined,
  at = new Date(),
): number | null {
  if (!sub || sub.status !== "trialing") return null;
  const ms = new Date(sub.currentPeriodEnd).getTime() - at.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export function isTrialExpired(
  sub: BillingSubscription | null | undefined,
  at = new Date(),
): boolean {
  if (!sub) return false;
  if (sub.status !== "trialing" && sub.plan !== "membro_plataforma") return false;
  return new Date(sub.currentPeriodEnd).getTime() <= at.getTime();
}
