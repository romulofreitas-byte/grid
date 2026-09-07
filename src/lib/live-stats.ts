import type { QueryClient } from "@tanstack/react-query";

export const LIVE_STATS_KEYS = [
  "painel-metrics",
  "box-queue",
  "ops-metrics",
  "ops-users",
  "ops-mural",
  "pilot-stats",
] as const;

export const BOX_QUEUE_QUERY_KEY = ["box-queue"] as const;

export const LIVE_STATS_QUERY_OPTIONS = {
  staleTime: 0,
  refetchOnWindowFocus: true as const,
  refetchOnMount: "always" as const,
};

export function invalidateLiveStats(
  qc: Pick<QueryClient, "invalidateQueries">,
): Promise<void[]> {
  return Promise.all(
    LIVE_STATS_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] })),
  );
}

export function originateCallJobsActive(
  jobs: readonly { verb: string; status: string }[],
): boolean {
  return jobs.some(
    (job) =>
      job.verb === "originate_call" &&
      (job.status === "pending" || job.status === "running"),
  );
}

export function originateCallJobsPollInterval(
  jobs: readonly { verb: string; status: string }[],
): number | false {
  return originateCallJobsActive(jobs) ? 3000 : false;
}
