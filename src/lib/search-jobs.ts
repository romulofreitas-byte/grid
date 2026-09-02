import type { Search, SearchFilters } from "@/lib/types";

export type SearchJobStatus = "pending" | "running" | "done" | "failed";

export type SearchJob = {
  id: string;
  user_id: string;
  nome: string;
  filtros: SearchFilters;
  status: SearchJobStatus;
  search_id: string | null;
  error: string | null;
  attempts: number;
  locked_at: string | null;
  created_at: string;
  finished_at: string | null;
};

export type SearchJobPublic = {
  jobId: string;
  status: SearchJobStatus;
  queuePosition: number;
  searchId: string | null;
  error: string | null;
  search: Search | null;
};

export function searchJobQueuePosition(
  aheadPending: number,
  status: SearchJobStatus,
): number {
  if (status !== "pending") return 0;
  return Math.max(1, aheadPending + 1);
}

export function toSearchJobPublic(
  job: SearchJob,
  aheadPending: number,
  search: Search | null = null,
): SearchJobPublic {
  return {
    jobId: job.id,
    status: job.status,
    queuePosition: searchJobQueuePosition(aheadPending, job.status),
    searchId: job.search_id,
    error: job.error,
    search,
  };
}

export const SEARCH_JOB_POLL_MS = 400;
export const SEARCH_JOB_POST_TIMEOUT_MS = 20_000;
export const SEARCH_JOB_LIVE_REUSE_MINUTES = 2;
export const SEARCH_JOB_DONE_REUSE_MINUTES = 10;

/** Vercel never runs runSearch inline — Railway/local/mock do. */
export function shouldRunSearchJobsInline(): boolean {
  const raw = process.env.DATA_SOURCE ?? "mock";
  const live = raw === "supabase" || raw === "postgres" || raw === "live";
  if (!live) return true;
  return !process.env.VERCEL;
}

export function searchJobConcurrency(
  raw: string | undefined = process.env.SEARCH_JOB_CONCURRENCY,
): number {
  const n = Number(raw ?? 2);
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(8, Math.floor(n));
}
