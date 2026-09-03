import { describe, expect, it } from "vitest";
import {
  aggregateOpsCohorts,
  classifyOpsCohort,
  effectivePlanSku,
} from "./classify";
import { isOpsProfileId } from "./ids";

describe("ops classify", () => {
  it("counts billed active subs as active", () => {
    expect(
      classifyOpsCohort({ livePlan: "piloto", liveStatus: "active" }),
    ).toBe("active");
    expect(
      classifyOpsCohort({ livePlan: "piloto_pro", liveStatus: "active" }),
    ).toBe("active");
  });

  it("counts platform trialing as trial", () => {
    expect(
      classifyOpsCohort({
        livePlan: "membro_plataforma",
        liveStatus: "trialing",
      }),
    ).toBe("trial");
  });

  it("treats everyone else as treino livre", () => {
    expect(classifyOpsCohort({ livePlan: null, liveStatus: null })).toBe("free");
    expect(
      classifyOpsCohort({ livePlan: "piloto", liveStatus: "canceled" }),
    ).toBe("free");
    expect(
      classifyOpsCohort({ livePlan: "piloto", liveStatus: "trialing" }),
    ).toBe("free");
  });

  it("aggregates cohorts, activation, plan mix and MRR", () => {
    const stats = aggregateOpsCohorts([
      {
        livePlan: "piloto",
        liveStatus: "active",
        cachedPlan: "piloto",
        activated: true,
      },
      {
        livePlan: "piloto",
        liveStatus: "active",
        cachedPlan: "piloto",
        activated: true,
      },
      {
        livePlan: "membro_plataforma",
        liveStatus: "trialing",
        cachedPlan: "membro_plataforma",
        activated: true,
      },
      {
        livePlan: null,
        liveStatus: null,
        cachedPlan: "free",
        activated: false,
      },
    ]);
    expect(stats).toMatchObject({
      users: 4,
      active: 2,
      trial: 1,
      free: 1,
      activated: 3,
      mrrCents: 19_400,
    });
    expect(stats.byPlan).toEqual({
      piloto: 2,
      membro_plataforma: 1,
      free: 1,
    });
    expect(
      effectivePlanSku({
        livePlan: null,
        liveStatus: null,
        cachedPlan: "free",
        activated: false,
      }),
    ).toBe("free");
  });
});

describe("ops profile id", () => {
  it("accepts uuids", () => {
    expect(isOpsProfileId("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isOpsProfileId("not-a-uuid")).toBe(false);
  });
});
