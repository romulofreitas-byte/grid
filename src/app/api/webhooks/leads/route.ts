import { NextResponse } from "next/server";
import { guardPublicApi } from "@/lib/auth/api-guard";
import { applyOneImportLead } from "@/lib/crm/import-apply";
import { inboundPayloadToInput } from "@/lib/crm/import";
import {
  hashInboundToken,
  parseBearerToken,
} from "@/lib/crm/inbound-token";
import { getRepo } from "@/lib/data";

export async function POST(req: Request) {
  const limited = await guardPublicApi(req, "webhook");
  if (limited) return limited;

  const token = parseBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Token ausente" }, { status: 401 });
  }

  const repo = getRepo();
  const endpoint = await repo.getCrmInboundEndpointByTokenHash(
    hashInboundToken(token),
  );
  if (!endpoint) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const result = await applyOneImportLead({
    repo,
    userId: endpoint.user_id,
    pipelineId: endpoint.pipeline_id,
    stageId: endpoint.stage_id ?? undefined,
    source: "inbound",
    row: inboundPayloadToInput(json),
  });
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(
    { deal_id: result.deal.id, created: result.created },
    { status: result.created ? 201 : 200 },
  );
}
