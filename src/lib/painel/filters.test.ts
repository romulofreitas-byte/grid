import { describe, expect, it } from "vitest";
import { parsePainelFilters, painelFiltersQueryString } from "./filters";

describe("parsePainelFilters", () => {
  it("defaults to 30d and accepts pipeline uuid", () => {
    expect(parsePainelFilters(new URLSearchParams()).range).toBe("30d");
    const parsed = parsePainelFilters(
      new URLSearchParams(
        "range=7d&pipeline=a1000000-0000-4000-8000-000000000001",
      ),
    );
    expect(parsed.range).toBe("7d");
    expect(parsed.pipelineId).toBe("a1000000-0000-4000-8000-000000000001");
  });

  it("drops invalid range and pipeline", () => {
    expect(parsePainelFilters(new URLSearchParams("range=90d")).range).toBe(
      "30d",
    );
    expect(
      parsePainelFilters(new URLSearchParams("pipeline=nicho")).pipelineId,
    ).toBeUndefined();
  });

  it("omits defaults from the query string", () => {
    expect(painelFiltersQueryString({ range: "30d" })).toBe("");
    expect(
      painelFiltersQueryString({
        range: "today",
        pipelineId: "a1000000-0000-4000-8000-000000000001",
      }),
    ).toBe("range=today&pipeline=a1000000-0000-4000-8000-000000000001");
  });
});
