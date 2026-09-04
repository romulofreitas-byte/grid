import { describe, expect, it } from "vitest";
import {
  calculateFunnel,
  defaultFunnelPlan,
  funnelPlanApplied,
  parseFunnelPlan,
} from "./funnel";

describe("calculateFunnel", () => {
  it("matches the original reverse funnel (80k / 15k at default rates)", () => {
    const result = calculateFunnel({
      metaFaturamento: 80_000,
      ticket: 15_000,
      taxa1: 20,
      taxa2: 70,
      taxa3: 80,
      taxa4: 50,
      prazoMeses: 0,
    });
    expect(result.contratos).toBe(6);
    expect(result.negociacoes).toBe(12);
    expect(result.r2).toBe(15);
    expect(result.r1).toBe(22);
    expect(result.ligacoesDecisor).toBe(110);
    expect(result.ready).toBe(false);
    expect(result.ligacoesPorDia).toBe(0);
  });

  it("matches the original planning layer (×3 dials, 3 days/week)", () => {
    const result = calculateFunnel({
      metaFaturamento: 80_000,
      ticket: 15_000,
      taxa1: 20,
      taxa2: 70,
      taxa3: 80,
      taxa4: 50,
      prazoMeses: 3,
      now: new Date("2026-09-03T12:00:00.000Z"),
    });
    expect(result.ligacoesDecisor).toBe(110);
    expect(result.ligacoesTotais).toBe(330);
    expect(result.semanas).toBe(13);
    expect(result.diasProspeccao).toBe(39);
    expect(result.ligacoesPorDia).toBe(9);
    expect(result.ready).toBe(true);
    expect(result.dataFinal).not.toBeNull();
  });

  it("stays empty until meta and ticket are filled", () => {
    expect(
      calculateFunnel({
        metaFaturamento: 0,
        ticket: 15_000,
        taxa1: 20,
        taxa2: 70,
        taxa3: 80,
        taxa4: 50,
        prazoMeses: 3,
      }).contratos,
    ).toBe(0);
    expect(
      calculateFunnel({
        metaFaturamento: 80_000,
        ticket: 0,
        taxa1: 20,
        taxa2: 70,
        taxa3: 80,
        taxa4: 50,
        prazoMeses: 3,
      }).ligacoesDecisor,
    ).toBe(0);
  });

  it("falls back to method defaults when a rate is zero", () => {
    const withZero = calculateFunnel({
      metaFaturamento: 80_000,
      ticket: 15_000,
      taxa1: 0,
      taxa2: 70,
      taxa3: 80,
      taxa4: 50,
      prazoMeses: 0,
    });
    const withDefault = calculateFunnel({
      metaFaturamento: 80_000,
      ticket: 15_000,
      taxa1: 20,
      taxa2: 70,
      taxa3: 80,
      taxa4: 50,
      prazoMeses: 0,
    });
    expect(withZero.ligacoesDecisor).toBe(withDefault.ligacoesDecisor);
  });
});

describe("parseFunnelPlan", () => {
  it("returns null for empty input and parses a saved plan", () => {
    expect(parseFunnelPlan(null)).toBeNull();
    expect(parseFunnelPlan("nope")).toBeNull();
    const parsed = parseFunnelPlan({
      metaFaturamento: 80_000,
      ticket: 15_000,
      prazoMeses: 3,
      taxa1: 20,
      taxa2: 70,
      taxa3: 80,
      taxa4: 50,
      taxasOrigem: "crm",
      appliedAt: "2026-09-03T12:00:00.000Z",
    });
    expect(parsed?.taxasOrigem).toBe("crm");
    expect(parsed?.metaFaturamento).toBe(80_000);
    expect(funnelPlanApplied(parsed)).toBe(true);
    expect(funnelPlanApplied(defaultFunnelPlan())).toBe(false);
    expect(parseFunnelPlan({ metaFaturamento: "150.000,50", ticket: "8.867,00" })?.metaFaturamento).toBe(150000.5);
  });
});
