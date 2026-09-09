import { describe, expect, it } from "vitest";
import {
  animatedNumberTweenFrom,
  formatAnimatedNumber,
} from "@/components/animated-number";

describe("formatAnimatedNumber", () => {
  it("formats integers in pt-BR", () => {
    expect(formatAnimatedNumber(368, "int")).toBe("368");
    expect(formatAnimatedNumber(3680.4, "int")).toBe("3.680");
  });

  it("formats BRL from cents", () => {
    expect(formatAnimatedNumber(4_900_000, "brl")).toBe("R$ 49.000,00");
  });

  it("formats percents as whole numbers", () => {
    expect(formatAnimatedNumber(33.4, "pct")).toBe("33%");
    expect(formatAnimatedNumber(0, "pct")).toBe("0%");
  });
});

describe("animatedNumberTweenFrom", () => {
  it("starts at zero on the first display", () => {
    expect(animatedNumberTweenFrom(null, 40, false)).toBe(0);
  });

  it("morphs from the previous value", () => {
    expect(animatedNumberTweenFrom(10, 40, false)).toBe(10);
  });

  it("skips the tween when motion is reduced", () => {
    expect(animatedNumberTweenFrom(null, 40, true)).toBe(40);
    expect(animatedNumberTweenFrom(10, 40, true)).toBe(40);
  });
});
