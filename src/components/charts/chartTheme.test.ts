import { describe, expect, it } from "vitest";
import { proportionalWidthPct } from "./chartTheme";

describe("proportionalWidthPct", () => {
  it("keeps 28 shorter than 30", () => {
    expect(proportionalWidthPct(30, 30)).toBe(100);
    expect(proportionalWidthPct(28, 30)).toBeCloseTo(93.33, 1);
    expect(proportionalWidthPct(28, 30)).toBeLessThan(proportionalWidthPct(30, 30));
  });

  it("does not inflate small counts toward the top of the funnel", () => {
    expect(proportionalWidthPct(0, 30)).toBe(0);
    expect(proportionalWidthPct(1, 30)).toBeCloseTo(3.33, 1);
  });
});
