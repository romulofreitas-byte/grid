import { isDirectoryUrl } from "@/lib/enrichment/directory-blocklist";
import { isEnrichmentComplete } from "@/lib/enrichment/fresh";
import type { LeadEnrichment } from "@/lib/types";

/** Bump when organic/Maps discovery rules change — stale misses re-run once. */
export const DOMAIN_DISCOVERY_VERSION = "2";

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

export function needsDiscoveryRetry(
  row: LeadEnrichment | null | undefined,
): boolean {
  if (!row || !isEnrichmentComplete(row)) return false;
  if (humanClearedDomain(row)) return false;
  if (discoveryVersionOf(row) === DOMAIN_DISCOVERY_VERSION) return false;
  if (row.domain_status === "nao_encontrado") return true;
  if (row.domain && isDirectoryUrl(row.domain)) return true;
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
