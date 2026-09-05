import { normalizeText } from "@/lib/normalize-text";
import type { CrmDealSearchHit, CrmOutcome, CrmPerson } from "@/lib/crm/types";

export const DEAL_SEARCH_MIN_CHARS = 2;
export const DEAL_SEARCH_MIN_DIGITS = 4;
export const DEAL_SEARCH_LIMIT = 8;
export const DEAL_SEARCH_LIMIT_MAX = 20;
export const DEAL_SEARCH_DEBOUNCE_MS = 120;

export type DealSearchable = {
  company_name: string;
  contact_name: string;
  cnpj: string | null;
  phones: string[];
  people: CrmPerson[];
};

export type DealSearchRankable = DealSearchable & {
  id: string;
  pipeline_id: string;
  updated_at: string;
};

export type DealSearchHitSource = DealSearchRankable & {
  stage_id: string;
  outcome: CrmOutcome;
};

export type CrmDealSearchOpts = {
  preferredPipelineId?: string | null;
  limit?: number;
};

export function dealSearchDigits(q: string): string {
  return q.replace(/\D/g, "");
}

export function dealSearchHasLetters(q: string): boolean {
  return /\p{L}/u.test(q);
}

export function canSearchDeals(q: string): boolean {
  const trimmed = q.trim();
  if (dealSearchDigits(trimmed).length >= DEAL_SEARCH_MIN_DIGITS) return true;
  if (!dealSearchHasLetters(trimmed)) return false;
  return trimmed.length >= DEAL_SEARCH_MIN_CHARS;
}

export function clampDealSearchLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return DEAL_SEARCH_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), DEAL_SEARCH_LIMIT_MAX);
}

function nameHaystack(deal: DealSearchable): string[] {
  const names = [deal.company_name, deal.contact_name];
  for (const person of deal.people ?? []) {
    if (person.name) names.push(person.name);
  }
  return names;
}

function digitHaystack(deal: DealSearchable): string[] {
  const out: string[] = [];
  if (deal.cnpj) {
    const digits = deal.cnpj.replace(/\D/g, "");
    if (digits) out.push(digits);
  }
  for (const phone of deal.phones ?? []) {
    const digits = phone.replace(/\D/g, "");
    if (digits) out.push(digits);
  }
  for (const person of deal.people ?? []) {
    const digits = person.phone.replace(/\D/g, "");
    if (digits) out.push(digits);
  }
  return out;
}

export function dealMatchesSearch(deal: DealSearchable, q: string): boolean {
  if (!canSearchDeals(q)) return false;
  const needle = normalizeText(q);
  const digits = dealSearchDigits(q);
  const nameOk =
    dealSearchHasLetters(q) && needle.length >= DEAL_SEARCH_MIN_CHARS;
  if (
    nameOk &&
    nameHaystack(deal).some((name) => normalizeText(name).includes(needle))
  ) {
    return true;
  }
  if (
    digits.length >= DEAL_SEARCH_MIN_DIGITS &&
    digitHaystack(deal).some((value) => value.includes(digits))
  ) {
    return true;
  }
  return false;
}

export function compareDealSearchHits(
  a: DealSearchRankable,
  b: DealSearchRankable,
  q: string,
  preferredPipelineId?: string | null,
): number {
  if (preferredPipelineId) {
    const ap = a.pipeline_id === preferredPipelineId ? 0 : 1;
    const bp = b.pipeline_id === preferredPipelineId ? 0 : 1;
    if (ap !== bp) return ap - bp;
  }
  const needle = normalizeText(q);
  const aPrefix = normalizeText(a.company_name).startsWith(needle) ? 0 : 1;
  const bPrefix = normalizeText(b.company_name).startsWith(needle) ? 0 : 1;
  if (aPrefix !== bPrefix) return aPrefix - bPrefix;
  return b.updated_at.localeCompare(a.updated_at);
}

export function rankDealSearchHits<T extends DealSearchRankable>(
  deals: T[],
  q: string,
  preferredPipelineId?: string | null,
): T[] {
  return [...deals].sort((a, b) =>
    compareDealSearchHits(a, b, q, preferredPipelineId),
  );
}

export function toDealSearchHit(input: {
  dealId: string;
  pipelineId: string;
  pipelineNome: string;
  stageNome: string;
  company_name: string;
  contact_name: string;
  outcome: CrmOutcome;
}): CrmDealSearchHit {
  return {
    dealId: input.dealId,
    pipelineId: input.pipelineId,
    pipelineNome: input.pipelineNome,
    stageNome: input.stageNome,
    company_name: input.company_name,
    contact_name: input.contact_name,
    outcome: input.outcome,
  };
}

export function searchHitsFromDeals(
  deals: DealSearchHitSource[],
  q: string,
  opts: {
    preferredPipelineId?: string | null;
    limit?: number;
    pipelineNome: (pipelineId: string) => string;
    stageNome: (stageId: string) => string;
  },
): CrmDealSearchHit[] {
  if (!canSearchDeals(q)) return [];
  const matches = deals.filter((deal) => dealMatchesSearch(deal, q));
  const ranked = rankDealSearchHits(matches, q, opts.preferredPipelineId);
  const limit = clampDealSearchLimit(opts.limit);
  return ranked.slice(0, limit).map((deal) =>
    toDealSearchHit({
      dealId: deal.id,
      pipelineId: deal.pipeline_id,
      pipelineNome: opts.pipelineNome(deal.pipeline_id),
      stageNome: opts.stageNome(deal.stage_id),
      company_name: deal.company_name,
      contact_name: deal.contact_name || deal.people?.[0]?.name || "",
      outcome: deal.outcome,
    }),
  );
}

export function mergeDealSearchHits(
  local: CrmDealSearchHit[],
  remote: CrmDealSearchHit[] | undefined,
  limit?: number,
): CrmDealSearchHit[] {
  const cap = clampDealSearchLimit(limit);
  const seen = new Set<string>();
  const out: CrmDealSearchHit[] = [];
  for (const hit of [...local, ...(remote ?? [])]) {
    if (seen.has(hit.dealId)) continue;
    seen.add(hit.dealId);
    out.push(hit);
    if (out.length >= cap) break;
  }
  return out;
}
