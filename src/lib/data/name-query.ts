import {
  companyIlikeTokens,
  companyNameTokens,
  escapeIlike,
} from "@/lib/data/company-search";
import { normalizeText } from "@/lib/normalize-text";

export const NAME_QUERY_MIN_CHARS = 3;
export const NAME_STEM_MIN_CHARS = 3;
/** Trade term on Maps/web ranking — skip "pet" and other short stems. */
export const QUALIFY_TRADE_NEEDLE_MIN = 4;
/** National typeahead without UF — GIN scan cap, not a full count. */
export const NAME_PREVIEW_SAMPLE_CAP = 2_000;
/** With UF the scan is index-friendly; still cap so a broad stem cannot run away. */
export const NAME_PREVIEW_UF_CAP = 20_000;
export const NAME_PREVIEW_CNAE_LIMIT = 12;

export type NamePreviewCnae = {
  codigo: string;
  descricao: string;
  nameHits: number;
};

export type NamePreview = {
  total: number;
  sampled: boolean;
  timedOut?: boolean;
  cnaes: NamePreviewCnae[];
};

export function emptyNamePreview(
  sampled = false,
  timedOut = false,
): NamePreview {
  return { total: 0, sampled, timedOut, cnaes: [] };
}

/** Accent-folded needles for fantasia/razão contains. Empty when the query is too short. */
export function nameQueryNeedles(raw: string | null | undefined): string[] {
  const text = (raw ?? "").trim();
  if (text.length < NAME_QUERY_MIN_CHARS) return [];
  const tokens = companyNameTokens(text).filter(
    (t) => t.length >= NAME_QUERY_MIN_CHARS,
  );
  if (tokens.length) return [...new Set(tokens)];
  const folded = normalizeText(text);
  return folded.length >= NAME_QUERY_MIN_CHARS ? [folded] : [];
}

function foldIlikeToken(token: string): string {
  return token.normalize("NFD").replace(/\p{M}/gu, "");
}

function ilikeVariants(token: string): string[] {
  const folded = foldIlikeToken(token);
  const out = [token];
  if (folded !== token && folded.length >= NAME_QUERY_MIN_CHARS) out.push(folded);
  return [...new Set(out)];
}

/**
 * One group per query token. Variants inside a group are OR (funerária|funeraria)
 * so GIN ILIKE still hits ASCII Receita names. Groups are AND.
 */
export function nameIlikeGroups(raw: string | null | undefined): string[][] {
  const text = (raw ?? "").trim();
  if (text.length < NAME_QUERY_MIN_CHARS) return [];
  const tokens = companyIlikeTokens(text).filter(
    (t) => t.length >= NAME_QUERY_MIN_CHARS,
  );
  const seeds = tokens.length ? tokens : [text];
  return seeds.map(ilikeVariants).filter((g) => g.length > 0);
}

/** Flat ILIKE needles (accented + ASCII) for GIN trigram on fantasia/razão. */
export function nameIlikeNeedles(raw: string | null | undefined): string[] {
  return [...new Set(nameIlikeGroups(raw).flat())];
}

export function canUseNameQuery(raw: string | null | undefined): boolean {
  return nameIlikeNeedles(raw).length > 0 || nameQueryNeedles(raw).length > 0;
}

export function nameStemNeedles(stems: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const stem of stems ?? []) {
    const n = normalizeText(stem);
    if (n.length >= NAME_STEM_MIN_CHARS) out.push(n);
  }
  return [...new Set(out)];
}

export function filtersUseNameMatch(input: {
  nameQuery?: string | null;
  matchNameStems?: boolean;
}): boolean {
  if (input.matchNameStems) return true;
  return (
    nameIlikeNeedles(input.nameQuery).length > 0 ||
    nameQueryNeedles(input.nameQuery).length > 0
  );
}

export function foldedNameHaystack(
  razaoSocial: string | null | undefined,
  nomeFantasia: string | null | undefined,
): string {
  return [razaoSocial, nomeFantasia]
    .map((v) => normalizeText(v ?? ""))
    .filter(Boolean)
    .join(" ");
}

export function establishmentNameMatches(
  razaoSocial: string | null | undefined,
  nomeFantasia: string | null | undefined,
  nameQuery: string | null | undefined,
  stems: string[] | null | undefined,
): boolean {
  const hay = foldedNameHaystack(razaoSocial, nomeFantasia);
  const queryNeedles = nameQueryNeedles(nameQuery);
  if (queryNeedles.length && !queryNeedles.every((n) => hay.includes(n))) {
    return false;
  }
  const stemNeedles = nameStemNeedles(stems);
  if (stemNeedles.length && !stemNeedles.some((n) => hay.includes(n))) {
    return false;
  }
  return true;
}

function uniqueFoldedNeedles(raw: string[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const n = normalizeText(item);
    if (n.length >= QUALIFY_TRADE_NEEDLE_MIN && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Needles from the list recorte to bias qualification — never a city-wide ramo search. */
export function qualifyTradeNeedles(input: {
  nameQuery?: string | null;
  matchNameStems?: boolean;
  stems?: string[] | null;
}): string[] {
  const fromQuery = uniqueFoldedNeedles([
    ...nameQueryNeedles(input.nameQuery),
    ...nameIlikeNeedles(input.nameQuery),
  ]);
  const fromStems = input.matchNameStems
    ? uniqueFoldedNeedles(nameStemNeedles(input.stems))
    : [];
  return [...new Set([...fromQuery, ...fromStems])];
}

export function haystackHasTradeNeedle(
  haystack: string | null | undefined,
  needles: string[] | null | undefined,
): boolean {
  if (!needles?.length) return false;
  const hay = normalizeText(haystack ?? "");
  if (!hay) return false;
  return needles.some((n) => hay.includes(normalizeText(n)));
}

/**
 * One compound extra name (`São José funerária`) when the Maps primary
 * (fantasia) does not already contain the list term. Empty if fantasia
 * already has it, or there is no fantasia (razão is the search name).
 */
export function qualifyTradeAliases(input: {
  fantasia?: string | null;
  razao: string;
  needles: string[];
}): string[] {
  const needles = uniqueFoldedNeedles(input.needles);
  if (!needles.length) return [];
  const fantasia = (input.fantasia ?? "").trim();
  if (!fantasia) return [];
  const missing = needles.find(
    (n) => !normalizeText(fantasia).includes(n),
  );
  if (!missing) return [];
  const alias = `${fantasia} ${missing}`.replace(/\s+/g, " ").trim();
  if (normalizeText(alias) === normalizeText(fantasia)) return [];
  return [alias];
}

/**
 * True when none of the distinctive stems appear in the official CNAE text —
 * churrascaria under "Restaurantes e similares", not barbearia under "…barbearia…".
 */
export function isUmbrellaSegment(
  stems: string[] | null | undefined,
  cnaeDescriptions: string[],
): boolean {
  const usable = nameStemNeedles(stems).filter((s) => s.length >= 4);
  if (!usable.length || !cnaeDescriptions.length) return false;
  const docs = cnaeDescriptions.map((d) => normalizeText(d)).join(" ");
  return !usable.some((stem) => docs.includes(stem));
}

function ilikePairSql(
  fantasiaExpr: string,
  razaoExpr: string,
  paramRef: string,
): string {
  return `(${fantasiaExpr} ilike ${paramRef} escape '\\' or ${razaoExpr} ilike ${paramRef} escape '\\')`;
}

/** GIN-friendly contains: ILIKE on the raw column, not translate/lower. */
export function nameContainsSql(
  fantasiaExpr: string,
  razaoExpr: string,
  startParam: number,
  needles: string[],
  mode: "and" | "or",
): { sql: string; params: string[] } | null {
  if (!needles.length) return null;
  const params: string[] = [];
  const parts = needles.map((needle, i) => {
    params.push(`%${escapeIlike(needle)}%`);
    return ilikePairSql(fantasiaExpr, razaoExpr, `$${startParam + i}`);
  });
  const sql = mode === "and" ? parts.join(" and ") : `(${parts.join(" or ")})`;
  return { sql, params };
}

/** AND of token groups; variants inside a group are OR. */
export function nameContainsGroupsSql(
  fantasiaExpr: string,
  razaoExpr: string,
  startParam: number,
  groups: string[][],
): { sql: string; params: string[] } | null {
  if (!groups.length) return null;
  const params: string[] = [];
  let p = startParam;
  const groupSql = groups
    .map((group) => {
      if (!group.length) return null;
      const parts = group.map((needle) => {
        params.push(`%${escapeIlike(needle)}%`);
        return ilikePairSql(fantasiaExpr, razaoExpr, `$${p++}`);
      });
      return parts.length === 1 ? parts[0]! : `(${parts.join(" or ")})`;
    })
    .filter((s): s is string => Boolean(s));
  if (!groupSql.length) return null;
  return { sql: groupSql.join(" and "), params };
}

export function nameIlikeAndSql(
  expr: string,
  startParam: number,
  needleCount: number,
): string {
  return Array.from(
    { length: needleCount },
    (_, i) => `${expr} ilike $${startParam + i} escape '\\'`,
  ).join(" and ");
}

/** Per-column ILIKE: OR variants in a group, AND groups. UNION arms reuse params. */
export function nameIlikeGroupsSql(
  expr: string,
  startParam: number,
  groups: string[][],
): string {
  let p = startParam;
  return groups
    .filter((g) => g.length > 0)
    .map((group) => {
      const parts = group.map(() => `${expr} ilike $${p++} escape '\\'`);
      return parts.length === 1 ? parts[0]! : `(${parts.join(" or ")})`;
    })
    .join(" and ");
}
