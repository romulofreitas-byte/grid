import { TAXONOMY, normalizeText } from "@/lib/niches";
import type { MarketBrief, NichePreset, SearchFilters } from "@/lib/types";
import { GENERIC_PACK, getMarketPack, janelaChipFrom, type MarketPack, type SeasonalHook } from "@/lib/market/packs";

function fillCity(text: string, cidade: string): string {
  return text.replaceAll("{cidade}", cidade);
}

export function interpolatePack(pack: MarketPack, cidade: string): MarketPack {
  const cidadeLabel = cidade.trim() || "esta cidade";
  return {
    ...pack,
    dorPrincipal: fillCity(pack.dorPrincipal, cidadeLabel),
    perguntaConsideracao: fillCity(pack.perguntaConsideracao, cidadeLabel),
    janelaHorario: fillCity(pack.janelaHorario, cidadeLabel),
    sazonalidade: pack.sazonalidade
      ? { ...pack.sazonalidade, gancho: fillCity(pack.sazonalidade.gancho, cidadeLabel) }
      : null,
    pontePorSinal: Object.fromEntries(
      Object.entries(pack.pontePorSinal).map(([id, phrase]) => [
        id,
        fillCity(phrase ?? "", cidadeLabel),
      ]),
    ),
  };
}

export function seasonalHookActive(
  hook: SeasonalHook | null,
  now = new Date(),
): boolean {
  if (!hook?.months.length) return false;
  const month = now.getMonth() + 1;
  const next = month === 12 ? 1 : month + 1;
  return hook.months.includes(month) || hook.months.includes(next);
}

export function matchSlugFromCnae(descricao: string): {
  slug: string;
  parentSlug: string;
} | null {
  const desc = normalizeText(descricao);
  if (!desc) return null;
  let best: { slug: string; parentSlug: string; len: number } | null = null;
  for (const niche of TAXONOMY) {
    for (const seg of niche.segments) {
      for (const kw of seg.keywords) {
        const k = normalizeText(kw);
        if (!k || !desc.includes(k)) continue;
        if (!best || k.length > best.len) {
          best = { slug: seg.slug, parentSlug: niche.slug, len: k.length };
        }
      }
    }
    for (const kw of niche.keywords) {
      const k = normalizeText(kw);
      if (!k || !desc.includes(k)) continue;
      if (!best || k.length > best.len) {
        best = { slug: niche.slug, parentSlug: niche.slug, len: k.length };
      }
    }
  }
  return best;
}

export function pickMarketPack(input: {
  presetSlug?: string | null;
  parentSlug?: string | null;
  cnaeDescricao: string;
}): MarketPack {
  const fromPreset = getMarketPack(input.presetSlug);
  if (fromPreset) return fromPreset;
  const fromParent = getMarketPack(input.parentSlug);
  if (fromParent) return fromParent;
  const matched = matchSlugFromCnae(input.cnaeDescricao);
  if (matched) {
    return (
      getMarketPack(matched.slug) ??
      getMarketPack(matched.parentSlug) ??
      GENERIC_PACK
    );
  }
  return GENERIC_PACK;
}

export function resolveMarketBrief(input: {
  presetSlug?: string | null;
  parentSlug?: string | null;
  cnaeDescricao: string;
  municipioNome: string;
  now?: Date;
}): MarketBrief {
  const pack = interpolatePack(
    pickMarketPack(input),
    input.municipioNome,
  );
  const ativa = seasonalHookActive(pack.sazonalidade, input.now);
  return {
    slug: pack.slug,
    nome: pack.nome,
    dorPrincipal: pack.dorPrincipal,
    dorChip: pack.dorChip,
    perguntaConsideracao: pack.perguntaConsideracao,
    sazonalidade: pack.sazonalidade?.gancho ?? null,
    sazonalidadeChip: pack.sazonalidadeChip,
    sazonalidadeMeses: pack.sazonalidade?.months ?? [],
    sazonalidadeAtiva: ativa,
    janelaHorario: pack.janelaHorario,
    janelaChip: janelaChipFrom(pack.janelaHorario),
    cidade: input.municipioNome.trim() || "esta cidade",
  };
}

export function resolveMarketPackForPonte(input: {
  presetSlug?: string | null;
  parentSlug?: string | null;
  cnaeDescricao: string;
  municipioNome: string;
}): MarketPack {
  return interpolatePack(pickMarketPack(input), input.municipioNome);
}

export function slugsFromSearch(
  filters: SearchFilters | undefined,
  presets: NichePreset[],
): { presetSlug: string | null; parentSlug: string | null } {
  const id = filters?.segmentIds[0] ?? filters?.presetId ?? null;
  if (!id) return { presetSlug: null, parentSlug: null };
  const preset = presets.find((p) => p.id === id);
  if (!preset) return { presetSlug: null, parentSlug: null };
  const parent = preset.parent_id
    ? presets.find((p) => p.id === preset.parent_id)
    : null;
  return {
    presetSlug: preset.slug,
    parentSlug: parent?.slug ?? (preset.parent_id ? null : preset.slug),
  };
}
