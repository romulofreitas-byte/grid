import { describe, expect, it } from "vitest";
import { canSpendQualifyCredits, qualifyCreditPool } from "./qualify-gate";

describe("canSpendQualifyCredits", () => {
  it("allows Treino livre while plan credits remain", () => {
    expect(
      canSpendQualifyCredits({
        enrichAllowed: false,
        trialExpired: false,
        plan: 25,
      }),
    ).toBe(true);
    expect(
      canSpendQualifyCredits({
        enrichAllowed: false,
        plan: 0,
      }),
    ).toBe(false);
  });

  it("blocks after the platform trial ends even with leftover plan credits", () => {
    expect(
      canSpendQualifyCredits({
        enrichAllowed: false,
        trialExpired: true,
        plan: 25,
      }),
    ).toBe(false);
  });

  it("allows paid plans regardless of the plan lot", () => {
    expect(
      canSpendQualifyCredits({
        enrichAllowed: true,
        plan: 0,
      }),
    ).toBe(true);
  });
});

describe("qualifyCreditPool", () => {
  it("counts only plan credits on Treino livre", () => {
    expect(
      qualifyCreditPool({ enrichAllowed: false, plan: 25, total: 125 }),
    ).toBe(25);
    expect(
      qualifyCreditPool({ enrichAllowed: true, plan: 0, total: 100 }),
    ).toBe(100);
  });
});
