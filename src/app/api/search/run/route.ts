import { NextResponse } from "next/server";
import { checkDailyRunSearch, recordDailyRunSearch } from "@/lib/auth/abuse-limits";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";
import { isUndefinedTableError } from "@/lib/data/pg";
import { drainSearchJobs } from "@/lib/enrichment/process-job";
import {
  shouldRunSearchJobsInline,
  toSearchJobPublic,
  type SearchJob,
} from "@/lib/search-jobs";
import { DEFAULT_FILTERS, type Search, type SearchFilters } from "@/lib/types";
import { z } from "zod";

export const maxDuration = 60;

function jobResponse(job: SearchJob, search: Search | null, ahead: number) {
  return NextResponse.json(toSearchJobPublic(job, ahead, search), {
    status: job.status === "done" ? 200 : 202,
    headers: { "Cache-Control": "no-store" },
  });
}

async function queuedJobResponse(job: SearchJob, userId: string) {
  try {
    const repo = getRepo();
    const latest = (await repo.getSearchJob(job.id, userId)) ?? job;
    const ahead = await repo.countSearchJobsAhead(latest);
    const search = latest.search_id
      ? ((await repo.getSearch(latest.search_id)) ?? null)
      : null;
    return jobResponse(latest, search, ahead);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "search_run_queued_lookup",
        id: job.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return jobResponse(job, null, 1);
  }
}

const schema = z.object({
  nome: z.string().min(1),
  filters: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const repo = getRepo();
  const userId = gated.userId;
  const filters = {
    ...DEFAULT_FILTERS,
    ...(parsed.data.filters as Partial<SearchFilters>),
  } as SearchFilters;

  try {
    const reusable = await repo.findReusableSearchJob(userId, filters);
    if (reusable) {
      try {
        if (shouldRunSearchJobsInline() && reusable.status !== "done") {
          await drainSearchJobs(1);
        }
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "search_run_reuse_drain",
            id: reusable.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return queuedJobResponse(reusable, userId);
    }

    const daily = await checkDailyRunSearch(userId);
    if (!daily.ok) {
      return NextResponse.json(
        {
          error: `Limite diário de listas atingido (${daily.limit}/dia no plano ${daily.plano}).`,
          code: "daily_run_search_limit",
          used: daily.used,
          limit: daily.limit,
        },
        { status: 429 },
      );
    }

    const job = await repo.enqueueSearchJob(userId, parsed.data.nome, filters);
    try {
      await recordDailyRunSearch(userId);
      if (shouldRunSearchJobsInline()) {
        await drainSearchJobs(1);
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "search_run_after_enqueue",
          id: job.id,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
    return queuedJobResponse(job, userId);
  } catch (err) {
    if (isUndefinedTableError(err)) {
      try {
        const search = await repo.runSearch(userId, parsed.data.nome, filters);
        await recordDailyRunSearch(userId);
        return NextResponse.json({
          jobId: search.id,
          status: "done",
          queuePosition: 0,
          searchId: search.id,
          error: null,
          search,
        });
      } catch (fallbackErr) {
        return dbUnavailableResponse(fallbackErr, "search_run");
      }
    }
    return dbUnavailableResponse(err, "search_run");
  }
}
