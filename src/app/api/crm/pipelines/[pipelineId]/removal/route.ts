import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError } from "@/app/api/crm/_http";
import { loadPipelineRemovalPreview } from "@/lib/crm/pipeline-removal";
import { getRepo } from "@/lib/data";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ pipelineId: string }> },
) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { pipelineId } = await ctx.params;
  const preview = await loadPipelineRemovalPreview(
    getRepo(),
    gated.userId,
    pipelineId,
  );
  if (!preview) return jsonError("Nicho não encontrado.", 404);
  return NextResponse.json({ preview });
}
