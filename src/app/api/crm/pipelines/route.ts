import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { pipelineCreateSchema } from "@/lib/crm/schema";

export async function GET(req: Request) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const pipelines = await getRepo().listCrmPipelines(gated.userId);
  return NextResponse.json({ pipelines });
}

export async function POST(req: Request) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const parsed = pipelineCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Dê um nome ao nicho.");
  const pipeline = await getRepo().createCrmPipeline(
    gated.userId,
    parsed.data.nome,
  );
  const board = await getRepo().getCrmBoard(gated.userId, pipeline.id);
  return NextResponse.json({ pipeline, board });
}
