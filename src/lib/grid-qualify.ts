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

/** Paid and still crawling stays “cruzando”. Billed without an in-flight job is Qualificado. */
export function isGridRowQualifying(
  row: {
    cnpj: string;
    hasAudit: boolean;
    enrichmentStatus: EnrichmentJobStatus | null;
  },
  pendingCnpjs: Set<string>,
): boolean {
  if (pendingCnpjs.has(row.cnpj)) return true;
  return isGridRowJobInFlight(row.enrichmentStatus);
}

export function gridOwnedEnrichmentStatus(input: {
  jobStatus: EnrichmentJobStatus | null | undefined;
  billed: boolean;
  hasEnrichment: boolean;
  previous?: EnrichmentJobStatus | null;
}): EnrichmentJobStatus | null {
  if (isGridRowJobInFlight(input.jobStatus)) return input.jobStatus ?? null;
  if (
    input.billed ||
    isGridRowAuditComplete(input.jobStatus) ||
    input.hasEnrichment
  ) {
    return isGridRowAuditComplete(input.jobStatus) ? input.jobStatus! : "done";
  }
  return input.jobStatus ?? input.previous ?? null;
}

export function isGridRowQualified(
  row: {
    hasAudit?: boolean;
    enrichmentStatus: EnrichmentJobStatus | null;
  },
  qualifying: boolean,
): boolean {
  if (qualifying) return false;
  if (isGridRowAuditComplete(row.enrichmentStatus)) return true;
  return Boolean(row.hasAudit) && row.enrichmentStatus !== "failed";
}
