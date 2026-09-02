import type { EnrichmentJob } from "@/lib/types";

export const INTERACTIVE_ENRICH_PRIORITY = 1;
export const BULK_ENRICH_PRIORITY = 0;

export const ENRICH_QUEUE_STUCK_MS = 15_000;
export const ENRICH_JOB_POLL_RUNNING_MS = 1_500;
export const ENRICH_JOB_POLL_PENDING_MS = 3_000;

export function enrichJobPriority(interactive: boolean): number {
  return interactive ? INTERACTIVE_ENRICH_PRIORITY : BULK_ENRICH_PRIORITY;
}

/** Interactive clicks (10/20/50, seleção, ficha) beat "qualificar a lista inteira". */
export function isInteractiveEnrichScope(
  scope: "first_unaudited" | "all_unaudited" | undefined,
): boolean {
  return scope !== "all_unaudited";
}

export function compareEnrichmentClaimOrder(
  a: Pick<EnrichmentJob, "priority" | "created_at" | "id">,
  b: Pick<EnrichmentJob, "priority" | "created_at" | "id">,
): number {
  const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
  if (byPriority !== 0) return byPriority;
  const byCreated = a.created_at.localeCompare(b.created_at);
  if (byCreated !== 0) return byCreated;
  return a.id - b.id;
}

/** Overlay only needs the newest job per CNPJ. */
export function latestEnrichmentJobPerCnpj(
  jobs: EnrichmentJob[],
): EnrichmentJob[] {
  const latest = new Map<string, EnrichmentJob>();
  for (const job of jobs) {
    const prev = latest.get(job.cnpj);
    if (
      !prev ||
      job.created_at > prev.created_at ||
      (job.created_at === prev.created_at && job.id > prev.id)
    ) {
      latest.set(job.cnpj, job);
    }
  }
  return [...latest.values()];
}
