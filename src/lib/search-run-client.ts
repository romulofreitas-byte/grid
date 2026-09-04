import type { Search, SearchFilters } from "@/lib/types";
import {
  SEARCH_JOB_POLL_MS,
  SEARCH_JOB_POLL_TIMEOUT_MS,
  SEARCH_JOB_POST_TIMEOUT_MS,
  type SearchJobPublic,
} from "@/lib/search-jobs";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  );
}

export async function waitForSearchJob(
  jobId: string,
  onQueue: (position: number) => void,
): Promise<Search> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const res = await fetch(`/api/search/jobs/${encodeURIComponent(jobId)}`, {
      signal: AbortSignal.timeout(SEARCH_JOB_POLL_TIMEOUT_MS),
    });
    const body = (await res.json()) as SearchJobPublic & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Não foi possível montar a lista");
    }
    onQueue(body.queuePosition);
    if (body.status === "done" && body.search) return body.search;
    if (body.status === "done") {
      throw new Error("Não foi possível montar a lista");
    }
    if (body.status === "failed") {
      throw new Error(body.error ?? "Não foi possível montar a lista");
    }
    await sleep(SEARCH_JOB_POLL_MS);
  }
  throw new Error("A fila está demorando. Abra Minhas listas em instantes.");
}

export async function runSearchJob(opts: {
  nome: string;
  filters: SearchFilters;
  onQueue: (position: number) => void;
}): Promise<Search> {
  opts.onQueue(0);
  try {
    const res = await fetch("/api/search/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: opts.nome, filters: opts.filters }),
      signal: AbortSignal.timeout(SEARCH_JOB_POST_TIMEOUT_MS),
    });
    const body = (await res.json()) as SearchJobPublic & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Não foi possível montar a lista");
    }
    if (body.search?.id) return body.search;
    if (!body.jobId) throw new Error("Não foi possível montar a lista");
    opts.onQueue(body.queuePosition);
    return await waitForSearchJob(body.jobId, opts.onQueue);
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error("A fila está demorando. Abra Minhas listas em instantes.");
    }
    throw err;
  }
}
