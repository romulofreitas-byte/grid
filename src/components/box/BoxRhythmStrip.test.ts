import { describe, expect, it } from "vitest";
import { sparklinePath } from "@/components/box/BoxRhythmStrip";

describe("sparklinePath", () => {
  it("draws a horizontal line for a single point", () => {
    expect(sparklinePath([4], 80, 20)).toBe("M 0 0.0 L 80 0.0");
  });

  it("maps values across the width", () => {
    expect(sparklinePath([0, 10], 100, 20)).toBe("M 0.0 20.0 L 100.0 0.0");
  });
});
