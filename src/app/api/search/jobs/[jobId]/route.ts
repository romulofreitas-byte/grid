import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { processOwnedSearchJob } from "@/lib/enrichment/process-job";
import { toSearchJobPublic } from "@/lib/search-jobs";

export const maxDuration = 60;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { jobId } = await ctx.params;
  const repo = getRepo();
  try {
    let job = await repo.getSearchJob(jobId, gated.userId);
    if (!job) {
      return NextResponse.json({ error: "Fila não encontrada" }, { status: 404 });
    }
    if (job.status === "pending" || job.status === "running") {
      try {
        job = (await processOwnedSearchJob(job.id, gated.userId)) ?? job;
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "search_job_poll_error",
            id: job.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        job = (await repo.getSearchJob(jobId, gated.userId)) ?? job;
      }
    }
    const ahead = await repo.countSearchJobsAhead(job);
    const search = job.search_id
      ? ((await repo.getSearch(job.search_id)) ?? null)
      : null;
    return NextResponse.json(toSearchJobPublic(job, ahead, search), {
      status: job.status === "done" || job.status === "failed" ? 200 : 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "search_job_get_error",
        id: jobId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return NextResponse.json(
      {
        jobId,
        status: "running",
        queuePosition: 1,
        searchId: null,
        error: null,
        search: null,
      },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }
}
