import { NextResponse } from "next/server";
import { z } from "zod";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { dealSearchQuerySchema } from "@/lib/crm/schema";

export async function GET(req: Request) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const url = new URL(req.url);
  const pipelineRaw = url.searchParams.get("pipeline") || undefined;
  const pipeline = z.string().uuid().safeParse(pipelineRaw);
  const parsed = dealSearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    pipeline: pipeline.success ? pipeline.data : undefined,
  });
  const q = parsed.success ? parsed.data.q : "";
  const hits = await getRepo().searchCrmDeals(gated.userId, q, {
    preferredPipelineId: parsed.success ? (parsed.data.pipeline ?? null) : null,
  });
  return NextResponse.json({ hits });
}
