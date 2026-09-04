import { describe, expect, it } from "vitest";
import {
  beginScoped,
  cnaeDigitsSql,
  cohortExpr,
  mrrExpr,
  periodSql,
  seriesStartSql,
  testerExcludeSql,
} from "./sql";

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
    expect(periodSql("s.created_at", "today")).toContain("date_trunc('day'");
    expect(periodSql("s.created_at", "month")).toContain("America/Sao_Paulo");
    expect(seriesStartSql("today")).toContain("::date");
    expect(seriesStartSql("today")).not.toContain("- 6");
    expect(seriesStartSql("30d")).toContain("- 29");
    expect(testerExcludeSql(true)).toContain("mundopodium@gmail.com");
    expect(testerExcludeSql(true)).toContain("rômulo freitas");
    expect(testerExcludeSql(false)).not.toContain("auth.users");
  });

  it("normalizes a CNAE expression to 7 digits", () => {
    expect(cnaeDigitsSql("cnae.code")).toBe(
      "lpad(regexp_replace(cnae.code, '[^0-9]', '', 'g'), 7, '0')",
    );
  });

  it("restricts Hoje to people with activity that day", () => {
    const { cte } = beginScoped({ range: "today" });
    expect(cte).toContain("enrichment_jobs");
    expect(cte).toContain("call_events");
    expect(cte).toContain("mundopodium@gmail.com");
  });
});
