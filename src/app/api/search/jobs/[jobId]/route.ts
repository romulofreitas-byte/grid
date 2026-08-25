import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { toSearchJobPublic } from "@/lib/search-jobs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { jobId } = await ctx.params;
  const repo = getRepo();
  const job = await repo.getSearchJob(jobId, gated.userId);
  if (!job) {
    return NextResponse.json({ error: "Fila não encontrada" }, { status: 404 });
  }
  const ahead = await repo.countSearchJobsAhead(job);
  const search = job.search_id
    ? ((await repo.getSearch(job.search_id)) ?? null)
    : null;
  return NextResponse.json(toSearchJobPublic(job, ahead, search));
}
