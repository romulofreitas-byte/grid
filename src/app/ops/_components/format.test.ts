import { describe, expect, it } from "vitest";
import { cnaeChartName } from "./format";

describe("cnaeChartName", () => {
  it("formats the Receita code next to the description", () => {
    expect(cnaeChartName("2391501", "Aparelhamento de mármores")).toBe(
      "2391-5/01 · Aparelhamento de mármores",
    );
  });

  it("falls back to the formatted code", () => {
    expect(cnaeChartName("5611201", "5611201")).toBe("5611-2/01");
  });
});
