import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOCAL_USER_ID } from "@/lib/data/pg";
import {
  checkDailyRunSearch,
  dailyRunSearchCap,
  recordDailyRunSearch,
  resetAbuseLimitsForTests,
} from "./abuse-limits";
import { resetBillingMemory } from "@/lib/billing/memory-store";

beforeEach(() => {
  process.env.DATA_SOURCE = "mock";
  process.env.BILLING_STORE = "memory";
  resetBillingMemory();
  resetAbuseLimitsForTests();
});

afterEach(() => {
  resetAbuseLimitsForTests();
});

describe("abuse limits", () => {
  it("caps free plan at 5 runSearch per day", () => {
    expect(dailyRunSearchCap("free")).toBe(5);
    expect(dailyRunSearchCap("piloto")).toBe(30);
  });

  it("blocks after daily limit", async () => {
    const userId = LOCAL_USER_ID;
    for (let i = 0; i < 5; i++) {
      await recordDailyRunSearch(userId);
    }
    const hit = await checkDailyRunSearch(userId);
    expect(hit.ok).toBe(false);
    expect(hit.used).toBe(5);
    expect(hit.limit).toBe(5);
  });
});
