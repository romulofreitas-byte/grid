import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { pipelineReorderSchema } from "@/lib/crm/schema";

export async function POST(req: Request) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const parsed = pipelineReorderSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Ordem inválida.");
  const ok = await getRepo().reorderCrmPipelines(
    gated.userId,
    parsed.data.pipelineIds,
  );
  if (!ok) return jsonError("Não foi possível reordenar os nichos.", 400);
  const pipelines = await getRepo().listCrmPipelines(gated.userId);
  return NextResponse.json({ pipelines });
}
