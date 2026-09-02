import { describe, expect, it } from "vitest";
import { ENRICH_CREDIT_COST } from "./catalog";
import { qualifyDaysRemaining, tankDaysLabel, tankHint } from "./tank";

describe("qualifyDaysRemaining", () => {
  it("fits Piloto 900 into ~20 fichas/dia", () => {
    expect(qualifyDaysRemaining(900, 20)).toBe(Math.floor(900 / (20 * ENRICH_CREDIT_COST)));
    expect(qualifyDaysRemaining(900, 20)).toBeGreaterThanOrEqual(22);
  });

  it("returns zero without credits or goal", () => {
    expect(qualifyDaysRemaining(0, 20)).toBe(0);
    expect(qualifyDaysRemaining(900, 0)).toBe(0);
  });
});

describe("tankDaysLabel", () => {
  it("asks for a plan when access is closed", () => {
    expect(tankDaysLabel(40, false)).toBe("Plano");
    expect(tankDaysLabel(1, true)).toBe("1 dia");
    expect(tankDaysLabel(18, true)).toBe("18 dias");
  });
});

describe("tankHint", () => {
  it("explains locked access without promising recarga reopens CRM", () => {
    expect(tankHint({ enrichAllowed: false, credits: 100, dailyGoal: 20 })).toMatch(
      /não reabre/i,
    );
  });

  it("speaks in days of meta when the tank has room", () => {
    const hint = tankHint({ enrichAllowed: true, credits: 900, dailyGoal: 20 });
    expect(hint).toMatch(/dias de meta/);
    expect(hint).toMatch(/900 créditos/);
    expect(hint).toContain(`${ENRICH_CREDIT_COST} por ficha`);
  });
});
