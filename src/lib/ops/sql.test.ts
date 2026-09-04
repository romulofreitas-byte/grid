import { describe, expect, it } from "vitest";
import { cohortExpr, mrrExpr, periodSql, seriesStartSql } from "./sql";

describe("ops sql fragments", () => {
  it("classifies billed active plans as active in SQL", () => {
    expect(cohortExpr()).toContain("piloto");
    expect(cohortExpr()).toContain("membro_plataforma");
    expect(cohortExpr()).toContain("'active'");
  });

  it("prices MRR from the catalog", () => {
    expect(mrrExpr()).toContain("9700");
    expect(mrrExpr()).toContain("19700");
  });

  it("builds a period predicate per range", () => {
    expect(periodSql("s.created_at", "all")).toBe("true");
    expect(periodSql("s.created_at", "7d")).toContain("7 days");
    expect(periodSql("s.created_at", "month")).toContain("America/Sao_Paulo");
    expect(seriesStartSql("30d")).toContain("- 29");
  });
});
