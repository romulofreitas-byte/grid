import { describe, expect, it } from "vitest";
import { countFunnel, FUNNEL_STEPS, funnelFromCounts } from "./funnel";

describe("ops funnel", () => {
  it("keeps the cadastro → pagou order", () => {
    expect(FUNNEL_STEPS.map((step) => step.id)).toEqual([
      "signed_up",
      "activated",
      "searched",
      "qualified",
      "paid",
    ]);
  });

  it("counts each etapa independently from the signup cohort", () => {
    const funnel = countFunnel([
      {
        activated: true,
        searched: true,
        qualified: true,
        paid: true,
        recharged: true,
      },
      {
        activated: true,
        searched: true,
        qualified: false,
        paid: false,
        recharged: false,
      },
      {
        activated: false,
        searched: false,
        qualified: false,
        paid: false,
        recharged: false,
      },
    ]);
    expect(funnel.steps.map((step) => step.count)).toEqual([3, 2, 2, 1, 1]);
    expect(funnel.recharged).toBe(1);
  });

  it("builds the same shape from SQL scalars", () => {
    expect(
      funnelFromCounts({
        signedUp: 10,
        activated: 8,
        searched: 7,
        qualified: 4,
        paid: 2,
        recharged: 1,
      }).steps[3],
    ).toEqual({ id: "qualified", label: "Qualificou", count: 4 });
  });
});
