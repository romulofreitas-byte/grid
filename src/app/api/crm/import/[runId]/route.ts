import { NextResponse } from "next/server";
import { z } from "zod";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError } from "@/app/api/crm/_http";
import { toPublicImportRunDetail } from "@/lib/crm/import-history";
import { getRepo } from "@/lib/data";

const runIdSchema = z.string().uuid();

export async function GET(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { runId } = await ctx.params;
  if (!runIdSchema.safeParse(runId).success) {
    return jsonError("Importação não encontrada.", 404);
  }
  const run = await getRepo().getCrmImportRun(gated.userId, runId);
  if (!run) return jsonError("Importação não encontrada.", 404);
  return NextResponse.json({ run: toPublicImportRunDetail(run) });
}
