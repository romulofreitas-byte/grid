import { COMPANY_NAME_MIN_CHARS, isCompanyCnpjQuery } from "@/lib/data/company-search";
import { normalizeText } from "@/lib/normalize-text";
import { PRESET_SEED } from "@/lib/niches";
import { rankPresetMatch } from "@/lib/segment-aliases";

/** Alias/name hit strong enough to offer "montar lista" from Empresas. */
export const ACTIVITY_SUGGESTION_MIN_RANK = 85;
/** Prefix hits like "ana"→análises need a longer stem; exact aliases ("spa") stay. */
const ACTIVITY_PREFIX_MIN_CHARS = 5;

export type ActivitySuggestion = {
  slug: string;
  nome: string;
  query: string;
};

/**
 * Maps a free-text query to a commercial niche when it looks like an activity
 * (madeireira, mineração), not a company name (Vale S.A.).
 */
export function matchActivitySuggestion(
  rawQuery: string,
): ActivitySuggestion | null {
  const query = rawQuery.trim();
  if (query.length < COMPANY_NAME_MIN_CHARS || isCompanyCnpjQuery(query)) return null;

  const parentNome = new Map(
    PRESET_SEED.filter((p) => !p.parent_slug).map((p) => [p.slug, p.nome]),
  );

  let best: { slug: string; nome: string; rank: number; segment: boolean } | null =
    null;

  for (const seed of PRESET_SEED) {
    const rank = rankPresetMatch(
      {
        nome: seed.nome,
        slug: seed.slug,
        aliases: seed.aliases,
        keywords: seed.keywords,
        parentNome: seed.parent_slug
          ? parentNome.get(seed.parent_slug)
          : undefined,
      },
      query,
    );
    if (rank < ACTIVITY_SUGGESTION_MIN_RANK) continue;
    if (
      rank < 95 &&
      normalizeText(query).length < ACTIVITY_PREFIX_MIN_CHARS
    ) {
      continue;
    }
    const segment = Boolean(seed.parent_slug);
    if (
      !best ||
      rank > best.rank ||
      (rank === best.rank && segment && !best.segment)
    ) {
      best = { slug: seed.slug, nome: seed.nome, rank, segment };
    }
  }

  if (!best) return null;
  return { slug: best.slug, nome: best.nome, query };
}
