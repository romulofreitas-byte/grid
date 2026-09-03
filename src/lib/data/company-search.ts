export type CompanySearchOpts = {
  ufs?: string[];
  limit?: number;
  soMatriz?: boolean;
};

export const COMPANY_NAME_MIN_CHARS = 3;
export const COMPANY_SEARCH_LIMIT = 20;
/** Second contain wave only runs when the prefix wave returns nothing. */
export const COMPANY_PREFIX_ENOUGH = 1;
/** Cap autocomplete so a name scan cannot hold the shared PG pool for 60s. */
export const COMPANY_NAME_SEARCH_TIMEOUT_MS = 4_000;

export function companySearchDigits(q: string): string {
  return q.replace(/\D/g, "");
}

export function isCompanyCnpjQuery(q: string): boolean {
  const digits = companySearchDigits(q);
  return digits.length >= 8 && digits.length <= 14;
}

export function canSearchCompanies(q: string): boolean {
  const t = q.trim();
  if (isCompanyCnpjQuery(t)) return true;
  return t.length >= COMPANY_NAME_MIN_CHARS;
}

export function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const ACCENT_FROM =
  "áàâãäåéèêëíìîïóòôõöúùûüýÿçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝÇÑ";
const ACCENT_TO =
  "aaaaaaeeeeiiiiooooouuuuyycnAAAAAAEEEEIIIIOOOOOUUUUYCN";

/** Legal form tokens — "Vale S.A." must search as "Vale", not "Vale SA". */
const COMPANY_LEGAL_STOPWORDS = new Set([
  "sa",
  "ltda",
  "me",
  "epp",
  "eireli",
  "slu",
]);

function splitNameTokens(q: string): string[] {
  return q
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

function dropLegalStopwords(tokens: string[]): string[] {
  const kept = tokens.filter(
    (t) => !COMPANY_LEGAL_STOPWORDS.has(t.toLowerCase()),
  );
  return kept.length ? kept : tokens;
}

/** Fold accents in a SQL text expression (no unaccent extension). */
export function sqlFoldAccent(expr: string): string {
  return `translate(lower(${expr}), '${ACCENT_FROM}', '${ACCENT_TO}')`;
}

export function companyNameTokens(q: string): string[] {
  const folded = q
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return dropLegalStopwords(splitNameTokens(folded));
}

/** Tokens for GIN ILIKE — keep the user's accents so `clínica` still hits. */
export function companyIlikeTokens(q: string): string[] {
  return dropLegalStopwords(splitNameTokens(q));
}

/** Format examples shown on /empresas — not a real CNPJ. */
export const CNPJ_EXAMPLE_FORMATTED = "00.000.000/0001-00";
export const CNPJ_EXAMPLE_DIGITS = "00000000000100";
export const CNPJ_EXAMPLE_ROOT = "00000000";

/**
 * True when every query token appears in razão or fantasia.
 * Fantasia-only brands match even if the legal name is unrelated.
 */
export function companyNameMatchesFields(
  q: string,
  razaoSocial: string,
  nomeFantasia: string | null | undefined,
): boolean {
  const tokens = companyNameTokens(q);
  if (!tokens.length) return false;
  const razao = companyNameTokens(razaoSocial).join(" ");
  const fantasia = companyNameTokens(nomeFantasia ?? "").join(" ");
  return tokens.every((t) => razao.includes(t) || fantasia.includes(t));
}

export function companyIlikePrefixPattern(q: string): string | null {
  const tokens = companyIlikeTokens(q);
  if (!tokens.length) return null;
  return `${escapeIlike(tokens.join(" "))}%`;
}

/**
 * True when `name` starts with the query as a whole word ("Vale S.A." → vale),
 * not as a stem of another word ("Valente").
 */
export function companyNameHasTokenPrefix(
  name: string,
  q: string,
): boolean {
  const phrase = companyNameTokens(q).join(" ");
  if (!phrase) return false;
  const n = companyNameTokens(name).join(" ");
  if (n === phrase) return true;
  if (!n.startsWith(phrase)) return false;
  const next = n[phrase.length];
  return next === undefined || next === " ";
}

/** Postgres regex: query is a word prefix, not Valente-from-Vale. */
export function companyPrefixWordRegex(
  q: string,
  folded = false,
): string | null {
  const tokens = folded ? companyNameTokens(q) : companyIlikeTokens(q);
  if (!tokens.length) return null;
  const escaped = tokens
    .join(" ")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^${escaped}([^[:alpha:]]|$)`;
}

export function mergeCompanyNameWaves<T extends { cnpj: string }>(
  prefixHits: T[],
  containHits: T[],
  limit: number,
): T[] {
  if (prefixHits.length >= COMPANY_PREFIX_ENOUGH) return prefixHits;
  const seen = new Set(prefixHits.map((h) => h.cnpj));
  const merged = [...prefixHits];
  for (const hit of containHits) {
    if (seen.has(hit.cnpj)) continue;
    seen.add(hit.cnpj);
    merged.push(hit);
    if (merged.length >= limit) break;
  }
  return merged;
}

export function isFullCnpjQuery(q: string): boolean {
  return companySearchDigits(q).length === 14;
}
