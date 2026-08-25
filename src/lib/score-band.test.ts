import { describe, expect, it } from "vitest";
import { scoreBand } from "./score-band";

describe("scoreBand", () => {
  it("maps thresholds used by the grid badge", () => {
    expect(scoreBand(84)).toBe("FRENTE");
    expect(scoreBand(85)).toBe("POLE");
    expect(scoreBand(70)).toBe("FRENTE");
    expect(scoreBand(50)).toBe("MEIO");
    expect(scoreBand(49)).toBe("FUNDO");
  });
});
