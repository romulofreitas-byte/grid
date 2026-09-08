import { planHasFeature } from "@/lib/billing/catalog";
import { TAXONOMY } from "@/lib/niches";
import { janelaChipFrom } from "@/lib/market/packs";
import { peakMonths, seasonStatus } from "@/lib/market/calendar";
import type { MarketBrief, MarketMunition, MarketSeason } from "@/lib/types";
import rows from "@/lib/market/niche-munition.json";
import seasonRows from "@/lib/market/niche-season.json";

type MunitionRow = MarketMunition & { slug: string; nome: string };
type SeasonRow = { slug: string; nome: string; sazonalidade: MarketSeason };

const PACKS: MunitionRow[] = rows as MunitionRow[];
const SEASONS: SeasonRow[] = seasonRows as SeasonRow[];

const BY_SLUG = new Map(PACKS.map((row) => [row.slug, row]));
const SEASON_BY_SLUG = new Map(SEASONS.map((row) => [row.slug, row]));

export function parentSlugForMarket(slug: string): string | null {
  for (const niche of TAXONOMY) {
    if (niche.slug === slug) return niche.slug;
    if (niche.segments.some((seg) => seg.slug === slug)) return niche.slug;
  }
  return null;
}

export function lookupMunition(slug: string | null | undefined): MarketMunition | null {
  const key = slug?.trim();
  if (!key) return null;
  const exact = BY_SLUG.get(key);
  if (exact) return stripRow(exact);
  const parent = parentSlugForMarket(key);
  if (parent && parent !== key) {
    const inherited = BY_SLUG.get(parent);
    if (inherited) return stripRow(inherited);
  }
  return null;
}

function stripRow(row: MunitionRow): MarketMunition {
  return {
    doresFaturamento: row.doresFaturamento,
    urgenciasOcultas: row.urgenciasOcultas,
    termosRamo: row.termosRamo,
    barreirasDecisao: row.barreirasDecisao,
    rotinaEstresse: row.rotinaEstresse,
  };
}

export function lookupSeason(slug: string | null | undefined): MarketSeason | null {
  const key = slug?.trim();
  if (!key) return null;
  const exact = SEASON_BY_SLUG.get(key);
  if (exact) return exact.sazonalidade;
  const parent = parentSlugForMarket(key);
  if (parent && parent !== key) {
    const inherited = SEASON_BY_SLUG.get(parent);
    if (inherited) return inherited.sazonalidade;
  }
  return null;
}

function applySeason(
  brief: MarketBrief,
  now: Date,
): Pick<
  MarketBrief,
  | "sazonalidade"
  | "sazonalidadeChip"
  | "sazonalidadeMeses"
  | "sazonalidadeAtiva"
  | "sazonalidadeBaixa"
> {
  const season = lookupSeason(brief.slug);
  if (!season) {
    return {
      sazonalidade: brief.sazonalidade,
      sazonalidadeChip: brief.sazonalidadeChip,
      sazonalidadeMeses: brief.sazonalidadeMeses,
      sazonalidadeAtiva: brief.sazonalidadeAtiva,
      sazonalidadeBaixa: brief.sazonalidadeBaixa ?? null,
    };
  }
  const months = peakMonths(season.mesesPico);
  const status = seasonStatus(months, now);
  return {
    sazonalidade: season.porQue.trim() || null,
    sazonalidadeChip: season.chip,
    sazonalidadeMeses: months,
    sazonalidadeAtiva: status === "agora" || status === "na-porta",
    sazonalidadeBaixa: season.baixa.trim() || null,
  };
}

export function attachMunition(brief: MarketBrief, now = new Date()): MarketBrief {
  const season = applySeason(brief, now);
  const munition = lookupMunition(brief.slug);
  if (!munition) {
    return {
      ...brief,
      ...season,
      dorCaixa: null,
      munition: null,
      munitionLocked: false,
      janelaEvitar: brief.janelaEvitar ?? null,
    };
  }
  const janela = munition.rotinaEstresse.janelaLigar.trim();
  return {
    ...brief,
    ...season,
    janelaHorario: janela || brief.janelaHorario,
    janelaChip: janela ? janelaChipFrom(janela) : brief.janelaChip,
    janelaEvitar: munition.rotinaEstresse.evitar.trim() || null,
    dorCaixa: munition.doresFaturamento[0] ?? null,
    munition,
    munitionLocked: false,
  };
}

/** Strip Pro copy before the dossier leaves the API. */
export function redactMarketBrief(
  brief: MarketBrief,
  plano: string | null | undefined,
): MarketBrief {
  const attached = attachMunition(brief);
  if (planHasFeature(plano, "market_munition")) {
    return { ...attached, munitionLocked: false };
  }
  if (planHasFeature(plano, "crm")) {
    return {
      ...attached,
      munition: null,
      munitionLocked: Boolean(attached.dorCaixa),
    };
  }
  return {
    ...attached,
    dorCaixa: null,
    munition: null,
    munitionLocked: false,
  };
}

export function munitionPackCount(): number {
  return PACKS.length;
}

export function seasonPackCount(): number {
  return SEASONS.length;
}
