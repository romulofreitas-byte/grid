import type { EnrichmentJob, EnrichmentJobStatus } from "@/lib/types";
import {
  ENRICH_JOB_POLL_PENDING_MS,
  ENRICH_JOB_POLL_RUNNING_MS,
  ENRICH_QUEUE_STUCK_MS,
} from "@/lib/enrichment/jobs";

export {
  ENRICH_JOB_POLL_PENDING_MS,
  ENRICH_JOB_POLL_RUNNING_MS,
  ENRICH_QUEUE_STUCK_MS,
};

export function enrichJobsPollInterval(jobs: EnrichmentJob[]): number | false {
  if (jobs.some((j) => j.status === "running")) return ENRICH_JOB_POLL_RUNNING_MS;
  if (jobs.some((j) => j.status === "pending")) return ENRICH_JOB_POLL_PENDING_MS;
  return false;
}

export function enrichQueueStuck(
  jobs: EnrichmentJob[],
  pendingOnlySince: number | null,
  now = Date.now(),
): boolean {
  if (pendingOnlySince == null) return false;
  const pending = jobs.some((j) => j.status === "pending");
  const running = jobs.some((j) => j.status === "running");
  return pending && !running && now - pendingOnlySince >= ENRICH_QUEUE_STUCK_MS;
}

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
