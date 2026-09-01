import type { EnrichmentJobStatus } from "@/lib/types";

export function isGridRowAuditComplete(
  status: EnrichmentJobStatus | null | undefined,
): boolean {
  return status === "done" || status === "skipped";
}

export function isGridRowJobInFlight(
  status: EnrichmentJobStatus | null | undefined,
): boolean {
  return status === "pending" || status === "running";
}

/** Paid is not the same as finished — billed rows stay “cruzando” until the job completes. */
export function isGridRowQualifying(
  row: {
    cnpj: string;
    hasAudit: boolean;
    enrichmentStatus: EnrichmentJobStatus | null;
  },
  pendingCnpjs: Set<string>,
): boolean {
  if (pendingCnpjs.has(row.cnpj)) return true;
  if (isGridRowJobInFlight(row.enrichmentStatus)) return true;
  if (
    row.hasAudit &&
    !isGridRowAuditComplete(row.enrichmentStatus) &&
    row.enrichmentStatus !== "failed"
  ) {
    return true;
  }
  return false;
}

export function isGridRowQualified(
  row: { enrichmentStatus: EnrichmentJobStatus | null },
  qualifying: boolean,
): boolean {
  if (qualifying) return false;
  return isGridRowAuditComplete(row.enrichmentStatus);
}
