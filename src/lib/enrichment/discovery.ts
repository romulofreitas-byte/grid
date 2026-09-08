import { domainHostMatchesBrand, handleMatchesBrand } from "@/lib/enrichment/brand-aliases";
import { isDirectoryUrl } from "@/lib/enrichment/directory-blocklist";
import { isEnrichmentComplete } from "@/lib/enrichment/fresh";
import { parseInstagramHandle } from "@/lib/instagram";
import { gmbListingStatus, type LeadEnrichment } from "@/lib/types";

/** Bump when organic/Maps discovery rules change — stale misses re-run once. */
export const DOMAIN_DISCOVERY_VERSION = "10";

export type DiscoveryBrand = {
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string;
};

export function discoveryVersionOf(
  row: LeadEnrichment | null | undefined,
): string | null {
  const value = row?.fonte.discovery?.fonte?.trim();
  return value || null;
}

export function humanClearedDomain(
  row: LeadEnrichment | null | undefined,
): boolean {
  if (!row) return false;
  if (row.fonte.domain?.fonte !== "human") return false;
  return !row.domain || row.domain_status === "nao_encontrado";
}

export function humanClearedMaps(
  row: LeadEnrichment | null | undefined,
): boolean {
  if (!row) return false;
  if (row.fonte.gmb?.fonte !== "human") return false;
  return gmbListingStatus(row.gmb) === "none";
}

export function mapsNeedsDiscoveryRetry(
  row: LeadEnrichment | null | undefined,
): boolean {
  if (!row || humanClearedMaps(row)) return false;
  return gmbListingStatus(row.gmb) === "none";
}

const TRUSTED_DOMAIN_FONTES = new Set(["gmb", "human"]);
const SERPER_INSTAGRAM_FONTES = new Set(["serper", "serper_kg"]);

function serperDomainLacksBrand(
  row: LeadEnrichment,
  brand: DiscoveryBrand,
): boolean {
  if (!row.domain) return false;
  const fonte = row.fonte.domain?.fonte;
  if (fonte && TRUSTED_DOMAIN_FONTES.has(fonte)) return false;
  return !domainHostMatchesBrand(
    row.domain,
    brand.razaoSocial,
    brand.nomeFantasia,
    brand.municipio,
  );
}

function serperInstagramLacksHandleBrand(
  row: LeadEnrichment,
  brand: DiscoveryBrand,
): boolean {
  const fonte = row.fonte.instagram?.fonte;
  if (!fonte || !SERPER_INSTAGRAM_FONTES.has(fonte)) return false;
  const handle = parseInstagramHandle(row.socials.instagram);
  if (!handle) return false;
  return !handleMatchesBrand(
    handle,
    brand.razaoSocial,
    brand.nomeFantasia,
    brand.municipio,
  );
}

/** Complete rows that may need a brand check before we skip re-qualify. */
export function needsBrandDiscoveryProbe(
  row: LeadEnrichment | null | undefined,
): boolean {
  if (!row) return false;
  const domainFonte = row.fonte.domain?.fonte;
  if (
    row.domain &&
    !isDirectoryUrl(row.domain) &&
    (!domainFonte || !TRUSTED_DOMAIN_FONTES.has(domainFonte))
  ) {
    return true;
  }
  const igFonte = row.fonte.instagram?.fonte;
  if (
    row.socials.instagram &&
    igFonte &&
    SERPER_INSTAGRAM_FONTES.has(igFonte)
  ) {
    return true;
  }
  return false;
}

export function needsDiscoveryRetry(
  row: LeadEnrichment | null | undefined,
  brand?: DiscoveryBrand,
): boolean {
  if (!row || !isEnrichmentComplete(row)) return false;
  if (humanClearedDomain(row)) return false;
  if (row.domain && isDirectoryUrl(row.domain)) return true;
  if (brand) {
    if (serperDomainLacksBrand(row, brand)) return true;
    if (serperInstagramLacksHandleBrand(row, brand)) return true;
  }
  if (discoveryVersionOf(row) === DOMAIN_DISCOVERY_VERSION) return false;
  if (row.domain_status === "nao_encontrado") return true;
  if (mapsNeedsDiscoveryRetry(row)) return true;
  return false;
}

export function stampDiscoveryFonte(
  fonte: LeadEnrichment["fonte"],
  collectedAt: string,
): LeadEnrichment["fonte"] {
  return {
    ...fonte,
    discovery: { fonte: DOMAIN_DISCOVERY_VERSION, coletado_em: collectedAt },
  };
}
