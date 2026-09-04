import { describe, expect, it } from "vitest";
import {
  clearOpsDimensions,
  DEFAULT_OPS_FILTERS,
  opsFiltersQueryString,
  opsFiltersToSearchParams,
  parseOpsDashboardFilters,
  parseOpsUserListParams,
  toggleOpsDimension,
  withOpsRange,
} from "./filters";

describe("ops dashboard filters", () => {
  it("defaults to 30 days and ignores junk", () => {
    const parsed = parseOpsDashboardFilters(
      new URLSearchParams("range=nope&cohort=vip&uf=XX&niche=abc&recharged=maybe"),
    );
    expect(parsed).toEqual(DEFAULT_OPS_FILTERS);
  });

  it("parses a full recorte", () => {
    const parsed = parseOpsDashboardFilters(
      new URLSearchParams(
        "range=7d&cohort=free&plan=piloto&uf=sp&niche=11111111-1111-4111-8111-111111111111&recharged=1",
      ),
    );
    expect(parsed).toEqual({
      range: "7d",
      cohort: "free",
      plan: "piloto",
      uf: "SP",
      nicheId: "11111111-1111-4111-8111-111111111111",
      recharged: true,
    });
  });

  it("roundtrips through the query string", () => {
    const filters = parseOpsDashboardFilters(
      new URLSearchParams("range=month&cohort=trial&recharged=0"),
    );
    const again = parseOpsDashboardFilters(opsFiltersToSearchParams(filters));
    expect(again).toEqual(filters);
    expect(opsFiltersQueryString(DEFAULT_OPS_FILTERS)).toBe("");
  });

  it("toggles a dimension on and off", () => {
    const withUf = toggleOpsDimension(DEFAULT_OPS_FILTERS, "uf", "SP");
    expect(withUf.uf).toBe("SP");
    expect(toggleOpsDimension(withUf, "uf", "SP").uf).toBeUndefined();
    const charged = toggleOpsDimension(DEFAULT_OPS_FILTERS, "recharged", true);
    expect(charged.recharged).toBe(true);
    expect(toggleOpsDimension(charged, "recharged", true).recharged).toBeUndefined();
  });

  it("keeps the period when clearing chips", () => {
    const current = withOpsRange(
      toggleOpsDimension(DEFAULT_OPS_FILTERS, "cohort", "active"),
      "90d",
    );
    expect(clearOpsDimensions(current)).toEqual({ range: "90d" });
  });

  it("parses today", () => {
    expect(parseOpsDashboardFilters(new URLSearchParams("range=today")).range).toBe(
      "today",
    );
  });

  it("parses user list pagination", () => {
    const parsed = parseOpsUserListParams(
      new URLSearchParams("q=ana&limit=999&offset=-4&range=7d"),
    );
    expect(parsed.q).toBe("ana");
    expect(parsed.limit).toBe(100);
    expect(parsed.offset).toBe(0);
    expect(parsed.filters.range).toBe("7d");
  });
});
