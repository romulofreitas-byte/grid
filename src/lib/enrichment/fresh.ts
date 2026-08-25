import type { EnrichmentStage, LeadEnrichment } from "@/lib/types";

export function enrichmentStage(
  row: LeadEnrichment | null | undefined,
): EnrichmentStage {
  return row?.stage ?? "complete";
}

export function isEnrichmentUnexpired(
  row: LeadEnrichment | null | undefined,
): boolean {
  if (!row) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

/** Complete audit, ignoring TTL — used to backfill CRM for old qualifies. */
export function isEnrichmentEverComplete(
  row: LeadEnrichment | null | undefined,
): boolean {
  if (!row) return false;
  return enrichmentStage(row) === "complete";
}

/** Grid scoring, hasAudit, skip re-qualify. Partials do not count. */
export function isEnrichmentComplete(
  row: LeadEnrichment | null | undefined,
): boolean {
  return isEnrichmentUnexpired(row) && isEnrichmentEverComplete(row);
}

/** Ficha can show arriving slices. */
export function isEnrichmentVisible(
  row: LeadEnrichment | null | undefined,
): boolean {
  return isEnrichmentUnexpired(row);
}
