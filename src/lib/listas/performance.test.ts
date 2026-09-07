import { describe, expect, it } from "vitest";
import {
  classifyLeadSlice,
  emptyListPerformance,
  indexListPerformance,
  leadMatchesRecorte,
  parseGridRecorte,
  parseGridRowFilter,
  parseListRecorte,
  partitionLeads,
  pctOf,
  performanceFromLeads,
} from "./performance";

describe("classifyLeadSlice", () => {
  it("lets a CRM win beat an in-progress lead status", () => {
    expect(
      classifyLeadSlice({ status: "reuniao", crmOutcome: "won" }),
    ).toBe("ganhos");
  });

  it("treats discarded or CRM lost as perdidos, unless won", () => {
    expect(
      classifyLeadSlice({ status: "descartado", crmOutcome: "open" }),
    ).toBe("perdidos");
    expect(
      classifyLeadSlice({ status: "ligando", crmOutcome: "lost" }),
    ).toBe("perdidos");
    expect(
      classifyLeadSlice({ status: "descartado", crmOutcome: "won" }),
    ).toBe("ganhos");
  });

  it("keeps untouched leads in parados", () => {
    expect(
      classifyLeadSlice({ status: "novo", crmOutcome: null }),
    ).toBe("parados");
  });
});

describe("partitionLeads", () => {
  it("counts each lead once", () => {
    expect(
      partitionLeads([
        { status: "novo", crmOutcome: null },
        { status: "ligando", crmOutcome: "open" },
        { status: "reuniao", crmOutcome: "won" },
        { status: "descartado", crmOutcome: null },
      ]),
    ).toEqual({ parados: 1, em_acao: 1, ganhos: 1, perdidos: 1 });
  });
});

describe("performanceFromLeads", () => {
  it("keeps overlapping actions off the exclusive slices", () => {
    const stats = performanceFromLeads("s1", [
      {
        status: "reuniao",
        crmOutcome: "won",
        qualified: true,
        called: true,
      },
      {
        status: "novo",
        crmOutcome: null,
        qualified: true,
        called: false,
      },
    ]);
    expect(stats).toMatchObject({
      searchId: "s1",
      total: 2,
      ganhos: 1,
      parados: 1,
      em_acao: 0,
      perdidos: 0,
      qualified: 2,
      called: 1,
    });
  });
});

describe("leadMatchesRecorte", () => {
  const won = {
    status: "reuniao" as const,
    crmOutcome: "won" as const,
    qualified: true,
    called: true,
  };

  it("matches slice, qualification, and call recortes independently", () => {
    expect(leadMatchesRecorte("ganhos", won)).toBe(true);
    expect(leadMatchesRecorte("em_acao", won)).toBe(false);
    expect(leadMatchesRecorte("qualificadas", won)).toBe(true);
    expect(leadMatchesRecorte("ligacoes", won)).toBe(true);
    expect(leadMatchesRecorte("cadastro", won)).toBe(false);
  });
});

describe("pctOf and parsers", () => {
  it("rounds a share of the list", () => {
    expect(pctOf(1, 3)).toBe(33);
    expect(pctOf(0, 10)).toBe(0);
    expect(pctOf(4, 0)).toBe(0);
  });

  it("parses known recortes", () => {
    expect(parseListRecorte("ganhos")).toBe("ganhos");
    expect(parseListRecorte("cadastro")).toBe(null);
    expect(parseGridRecorte("cadastro")).toBe("cadastro");
    expect(parseGridRecorte("nope")).toBe(null);
    expect(parseGridRowFilter("qualified")).toBe("qualificadas");
    expect(parseGridRowFilter("all")).toBe("all");
  });

  it("fills missing search ids with zeros", () => {
    const indexed = indexListPerformance(
      [{ ...emptyListPerformance("a"), total: 4, parados: 4 }],
      ["a", "b"],
    );
    expect(indexed.a.total).toBe(4);
    expect(indexed.b).toEqual(emptyListPerformance("b"));
  });
});
