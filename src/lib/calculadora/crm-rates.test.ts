import { describe, expect, it } from "vitest";
import { suggestCrmRates, type CrmRateDeal } from "./crm-rates";

function deal(
  partial: Pick<CrmRateDeal, "canonical_key"> & Partial<CrmRateDeal>,
): CrmRateDeal {
  return {
    outcome: "open",
    amount_cents: null,
    ...partial,
  };
}

describe("suggestCrmRates", () => {
  it("returns null rates and ticket without enough sample", () => {
    const suggestions = suggestCrmRates({
      deals: [
        deal({ canonical_key: "reuniao_realizada" }),
        deal({ canonical_key: "proposta_apresentada" }),
        deal({ canonical_key: "negociacao" }),
        deal({ canonical_key: "contrato_fechado", outcome: "won", amount_cents: 1_500_000 }),
      ],
    });
    expect(suggestions.taxa1).toBeNull();
    expect(suggestions.taxa2).toBeNull();
    expect(suggestions.taxa3).toBeNull();
    expect(suggestions.taxa4).toBeNull();
    expect(suggestions.ticket).toBeNull();
  });

  it("computes percents from realized stages, not dials or scheduled meetings", () => {
    const deals: CrmRateDeal[] = [
      ...Array.from({ length: 20 }, () => deal({ canonical_key: "tentando_contato" })),
      ...Array.from({ length: 8 }, () => deal({ canonical_key: "reuniao_agendada" })),
      ...Array.from({ length: 10 }, () => deal({ canonical_key: "followup_decisor" })),
      ...Array.from({ length: 8 }, () => deal({ canonical_key: "reuniao_realizada" })),
      ...Array.from({ length: 6 }, () => deal({ canonical_key: "proposta_apresentada" })),
      ...Array.from({ length: 5 }, () => deal({ canonical_key: "negociacao" })),
      deal({
        canonical_key: "contrato_fechado",
        outcome: "won",
        amount_cents: 1_500_000,
      }),
      deal({
        canonical_key: "contrato_fechado",
        outcome: "won",
        amount_cents: 2_500_000,
      }),
      deal({
        canonical_key: "contrato_fechado",
        outcome: "won",
        amount_cents: null,
      }),
    ];
    const suggestions = suggestCrmRates({ deals });
    expect(suggestions.taxa1).toEqual({
      percent: 69,
      numerador: 22,
      denominador: 32,
    });
    expect(suggestions.taxa2).toEqual({
      percent: 64,
      numerador: 14,
      denominador: 22,
    });
    expect(suggestions.taxa3).toEqual({
      percent: 57,
      numerador: 8,
      denominador: 14,
    });
    expect(suggestions.taxa4).toEqual({
      percent: 38,
      numerador: 3,
      denominador: 8,
    });
    expect(suggestions.ticket).toEqual({ reais: 20000, amostra: 2 });
  });

  it("does not fall back to attempts when decision-maker sample is thin", () => {
    const deals: CrmRateDeal[] = [
      ...Array.from({ length: 10 }, () => deal({ canonical_key: "tentando_contato" })),
      ...Array.from({ length: 4 }, () => deal({ canonical_key: "reuniao_agendada" })),
      ...Array.from({ length: 2 }, () => deal({ canonical_key: "reuniao_realizada" })),
    ];
    const suggestions = suggestCrmRates({ deals });
    expect(suggestions.taxa1).toBeNull();
    expect(suggestions.taxa2).toBeNull();
  });

  it("ignores discarded deals and won-without-amount in the ticket", () => {
    const deals: CrmRateDeal[] = [
      ...Array.from({ length: 5 }, () => deal({ canonical_key: "descartado" })),
      deal({ canonical_key: "contrato_fechado", outcome: "won", amount_cents: 1_000_000 }),
    ];
    const suggestions = suggestCrmRates({ deals });
    expect(suggestions.taxa1).toBeNull();
    expect(suggestions.ticket).toBeNull();
  });
});
