import { describe, expect, it } from "vitest";
import {
  addUtcDays,
  isTrialExpired,
  PLATFORM_TRIAL_DAYS,
  subscriptionGrantsAccess,
  trialDaysRemaining,
} from "./access";
import type { BillingSubscription } from "./types";

function sub(
  over: Partial<BillingSubscription> = {},
): BillingSubscription {
  return {
    id: "sub-1",
    profileId: "p1",
    plan: "membro_plataforma",
    status: "trialing",
    provider: "platform",
    providerSubId: null,
    currentPeriodStart: "2026-08-01T00:00:00.000Z",
    currentPeriodEnd: "2026-08-31T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    ...over,
  };
}

describe("subscriptionGrantsAccess", () => {
  it("allows trialing and active inside the period", () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    expect(subscriptionGrantsAccess(sub(), now)).toBe(true);
    expect(
      subscriptionGrantsAccess(sub({ status: "active", plan: "piloto" }), now),
    ).toBe(true);
  });

  it("denies past_due and ended periods", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(subscriptionGrantsAccess(sub(), now)).toBe(false);
    expect(
      subscriptionGrantsAccess(
        sub({
          status: "past_due",
          currentPeriodEnd: "2026-09-15T00:00:00.000Z",
        }),
        new Date("2026-09-01T00:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

describe("trialDaysRemaining", () => {
  it("returns null unless trialing", () => {
    expect(
      trialDaysRemaining(sub({ status: "active" }), new Date("2026-08-15T00:00:00.000Z")),
    ).toBeNull();
  });

  it("counts remaining calendar days", () => {
    expect(
      trialDaysRemaining(sub(), new Date("2026-08-01T00:00:00.000Z")),
    ).toBe(30);
    expect(
      trialDaysRemaining(sub(), new Date("2026-08-31T00:00:00.000Z")),
    ).toBe(0);
  });
});

describe("isTrialExpired", () => {
  it("flags ended platform trials", () => {
    expect(isTrialExpired(sub(), new Date("2026-09-01T00:00:00.000Z"))).toBe(
      true,
    );
    expect(isTrialExpired(sub(), new Date("2026-08-15T00:00:00.000Z"))).toBe(
      false,
    );
  });
});

describe("addUtcDays", () => {
  it("matches the platform trial window", () => {
    const start = new Date("2026-08-24T12:00:00.000Z");
    expect(addUtcDays(start, PLATFORM_TRIAL_DAYS).toISOString()).toBe(
      "2026-09-23T12:00:00.000Z",
    );
  });
});
