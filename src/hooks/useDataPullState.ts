"use client";

import {
  useIsFetching,
  useIsMutating,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { EnrichmentJob } from "@/lib/types";

export type DataPullLongOp = "grid" | "audit" | null;

const SHOW_DELAY_MS = 200;
const HIDE_DELAY_MS = 150;

function useDelayedBoolean(
  value: boolean,
  showDelay: number,
  hideDelay: number,
) {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const ms = value ? showDelay : hideDelay;
    const id = window.setTimeout(() => setDelayed(value), ms);
    return () => window.clearTimeout(id);
  }, [value, showDelay, hideDelay]);

  return delayed;
}

function jobsFromCache(data: unknown): EnrichmentJob[] {
  if (!data || typeof data !== "object") return [];
  const jobs = (data as { jobs?: unknown }).jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs as EnrichmentJob[];
}

function hasActiveAuditJobs(data: unknown): boolean {
  return jobsFromCache(data).some(
    (job) => job.status === "pending" || job.status === "running",
  );
}

function getAuditingSnapshot(qc: QueryClient): boolean {
  return qc
    .getQueryCache()
    .findAll({ queryKey: ["enrich-jobs"] })
    .some(
      (query) =>
        query.getObserversCount() > 0 && hasActiveAuditJobs(query.state.data),
    );
}

export function useDataPullState() {
  const fetching = useIsFetching({
    predicate: (query) =>
      query.queryKey[0] !== "enrich-jobs" &&
      query.queryKey[0] !== "lead-stream",
  });
  const mutating = useIsMutating();
  const searchRun = useIsMutating({ mutationKey: ["search-run"] });
  const qc = useQueryClient();

  const subscribeAuditing = useCallback(
    (onStoreChange: () => void) => {
      let prev = getAuditingSnapshot(qc);
      return qc.getQueryCache().subscribe(() => {
        const next = getAuditingSnapshot(qc);
        if (next === prev) return;
        prev = next;
        onStoreChange();
      });
    },
    [qc],
  );

  const auditing = useSyncExternalStore(
    subscribeAuditing,
    () => getAuditingSnapshot(qc),
    () => false,
  );

  const busy = useDelayedBoolean(
    fetching + mutating > 0,
    SHOW_DELAY_MS,
    HIDE_DELAY_MS,
  );
  const longOp: DataPullLongOp =
    searchRun > 0 ? "grid" : auditing ? "audit" : null;

  return { busy, longOp };
}
