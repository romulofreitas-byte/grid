import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { applyImportLeads } from "@/lib/crm/import-apply";
import { crmImportSchema } from "@/lib/crm/schema";
import { getRepo } from "@/lib/data";

export async function POST(req: Request) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const parsed = crmImportSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return jsonError("Envie até 500 linhas com pipeline.");
  }
  const result = await applyImportLeads({
    repo: getRepo(),
    userId: gated.userId,
    pipelineId: parsed.data.pipeline_id,
    stageId: parsed.data.stage_id,
    source: "import",
    rows: parsed.data.rows,
  });
  if ("error" in result) return jsonError(result.error, result.status);
  return NextResponse.json(result);
}
