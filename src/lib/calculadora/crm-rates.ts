import { isCrmStageKey, type CrmStageKey } from "@/lib/crm/cadence";
import type { CrmOutcome } from "@/lib/crm/types";
import { roundReais } from "@/lib/calculadora/money";

export const MIN_RATE_SAMPLE = 5;
export const MIN_TICKET_SAMPLE = 2;

const STAGE_RANK: Record<CrmStageKey, number> = {
  entrada: 0,
  tentando_contato: 1,
  contato_respondido: 2,
  followup_decisor: 3,
  reuniao_agendada: 4,
  reuniao_realizada: 5,
  ajustando_proposta: 6,
  proposta_apresentada: 7,
  negociacao: 8,
  contrato_fechado: 9,
  descartado: -1,
};

export type CrmRateDeal = {
  canonical_key: string | null;
  outcome: CrmOutcome;
  amount_cents: number | null;
};

export type CrmRateSample = {
  percent: number;
  numerador: number;
  denominador: number;
};

export type CrmRateSuggestions = {
  taxa1: CrmRateSample | null;
  taxa2: CrmRateSample | null;
  taxa3: CrmRateSample | null;
  taxa4: CrmRateSample | null;
  ticket: { reais: number; amostra: number } | null;
};

export type CrmRateInput = {
  deals: readonly CrmRateDeal[];
};

function rankOf(deal: CrmRateDeal): number {
  if (deal.outcome === "won") return STAGE_RANK.contrato_fechado;
  const key = isCrmStageKey(deal.canonical_key) ? deal.canonical_key : null;
  if (!key) return 0;
  return STAGE_RANK[key] ?? 0;
}

function reached(deal: CrmRateDeal, minRank: number): boolean {
  return rankOf(deal) >= minRank;
}

/** Spoke with the decision-maker. Scheduled / gatekeeper stages do not count. */
export function isDecisorEfetivado(deal: CrmRateDeal): boolean {
  const rank = rankOf(deal);
  return rank === STAGE_RANK.followup_decisor || rank >= STAGE_RANK.reuniao_realizada;
}

function sample(numerador: number, denominador: number): CrmRateSample | null {
  if (denominador < MIN_RATE_SAMPLE) return null;
  const percent = Math.round((numerador / denominador) * 100);
  return {
    percent: Math.max(1, Math.min(100, percent)),
    numerador,
    denominador,
  };
}

export function suggestCrmRates(input: CrmRateInput): CrmRateSuggestions {
  const deals = input.deals.filter((deal) => rankOf(deal) >= 0);
  const decisor = deals.filter(isDecisorEfetivado).length;
  const r1 = deals.filter((deal) => reached(deal, STAGE_RANK.reuniao_realizada)).length;
  const r2 = deals.filter((deal) =>
    reached(deal, STAGE_RANK.proposta_apresentada),
  ).length;
  const negociacao = deals.filter((deal) =>
    reached(deal, STAGE_RANK.negociacao),
  ).length;
  const won = deals.filter((deal) => deal.outcome === "won").length;

  const wonAmounts = deals
    .filter((deal) => deal.outcome === "won" && deal.amount_cents != null && deal.amount_cents > 0)
    .map((deal) => deal.amount_cents as number);
  const ticket =
    wonAmounts.length >= MIN_TICKET_SAMPLE
      ? {
          reais: roundReais(
            wonAmounts.reduce((sum, cents) => sum + cents, 0) /
              wonAmounts.length /
              100,
          ),
          amostra: wonAmounts.length,
        }
      : null;

  return {
    taxa1: sample(Math.min(r1, decisor), decisor),
    taxa2: sample(r2, r1),
    taxa3: sample(negociacao, r2),
    taxa4: sample(won, negociacao),
    ticket,
  };
}
