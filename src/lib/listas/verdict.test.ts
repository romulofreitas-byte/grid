import { describe, expect, it } from "vitest";
import { emptyListPerformance, type ListPerformance } from "./performance";
import { listVerdict } from "./verdict";

function stats(patch: Partial<ListPerformance>): ListPerformance {
  return { ...emptyListPerformance("s1"), total: 10, parados: 10, ...patch };
}

describe("listVerdict", () => {
  it("calls out a win first", () => {
    expect(listVerdict(stats({ ganhos: 1, parados: 9, called: 4 }))).toBe(
      "has_win",
    );
  });

  it("treats a list with no qualify and no calls as idle", () => {
    expect(listVerdict(stats({}))).toBe("idle");
  });

  it("notices qualification without calls", () => {
    expect(listVerdict(stats({ qualified: 5 }))).toBe("qualified_no_calls");
  });

  it("flags heavy discard after calls", () => {
    expect(
      listVerdict(
        stats({
          called: 8,
          perdidos: 7,
          em_acao: 1,
          parados: 2,
          qualified: 8,
        }),
      ),
    ).toBe("high_discard");
  });

  it("points to another list when this one discarded and another already won", () => {
    expect(
      listVerdict(
        stats({
          called: 8,
          perdidos: 7,
          em_acao: 1,
          parados: 2,
          qualified: 8,
        }),
        { otherHasWin: true },
      ),
    ).toBe("has_win_elsewhere");
  });

  it("does not treat zeros as heavy discard", () => {
    expect(listVerdict(stats({ called: 3, em_acao: 3, parados: 7 }))).toBe(
      "in_progress",
    );
  });
});
