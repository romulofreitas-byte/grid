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

/** Fold accents in a SQL text expression (no unaccent extension). */
export function sqlFoldAccent(expr: string): string {
  return `translate(lower(${expr}), '${ACCENT_FROM}', '${ACCENT_TO}')`;
}

export function companyNameTokens(q: string): string[] {
  return q
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length >= 2);
}

/** Tokens for GIN ILIKE — keep the user's accents so `clínica` still hits. */
export function companyIlikeTokens(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length >= 2);
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
