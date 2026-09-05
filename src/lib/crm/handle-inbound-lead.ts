import { NextResponse } from "next/server";
import { planHasFeature } from "@/lib/billing/catalog";
import { planRequiredPayload } from "@/lib/billing/paywall";
import { getBalance } from "@/lib/billing/service";
import { AUTOMATIONS_NOT_ALLOWED_MESSAGE } from "@/lib/billing/types";
import { applyOneImportLead } from "@/lib/crm/import-apply";
import { inboundPayloadToInput } from "@/lib/crm/import";
import {
  clipInboundPayload,
  emptyInboundSnapshot,
  snapshotInboundInput,
} from "@/lib/crm/inbound-events";
import {
  hashInboundToken,
  parseBearerToken,
} from "@/lib/crm/inbound-token";
import type { CrmInboundEndpoint } from "@/lib/crm/types";
import { getRepo } from "@/lib/data";

async function persistInboundEvent(
  endpoint: CrmInboundEndpoint,
  input: {
    status: "created" | "skipped" | "error";
    httpStatus: number;
    message: string;
    dealId?: string | null;
    json?: unknown;
  },
) {
  try {
    const row = inboundPayloadToInput(input.json);
    await getRepo().createCrmInboundEvent(endpoint.user_id, {
      endpointId: endpoint.id,
      status: input.status,
      httpStatus: input.httpStatus,
      message: input.message,
      dealId: input.dealId ?? null,
      snapshot: input.json == null ? emptyInboundSnapshot() : snapshotInboundInput(row),
      payload: clipInboundPayload(input.json),
    });
  } catch (err) {
    console.error("inbound_event_persist_error", err);
  }
}

export async function handleInboundLeadPost(
  req: Request,
  opts?: { endpointId?: string },
): Promise<NextResponse> {
  const token = parseBearerToken(req.headers.get("authorization"));
  const repo = getRepo();
  const urlEndpoint = opts?.endpointId
    ? await repo.findCrmInboundEndpoint(opts.endpointId)
    : null;

  if (!token) {
    if (urlEndpoint) {
      await persistInboundEvent(urlEndpoint, {
        status: "error",
        httpStatus: 401,
        message: "Token ausente",
      });
    }
    return NextResponse.json({ error: "Token ausente" }, { status: 401 });
  }

  const endpoint = await repo.getCrmInboundEndpointByTokenHash(
    hashInboundToken(token),
  );
  if (!endpoint || (opts?.endpointId && endpoint.id !== opts.endpointId)) {
    if (urlEndpoint) {
      await persistInboundEvent(urlEndpoint, {
        status: "error",
        httpStatus: 401,
        message: "Token inválido",
      });
    }
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const owner = await getBalance(endpoint.user_id);
  if (!planHasFeature(owner.plano, "automations")) {
    await persistInboundEvent(endpoint, {
      status: "error",
      httpStatus: 403,
      message: AUTOMATIONS_NOT_ALLOWED_MESSAGE,
    });
    return NextResponse.json(planRequiredPayload(AUTOMATIONS_NOT_ALLOWED_MESSAGE), {
      status: 403,
    });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    await persistInboundEvent(endpoint, {
      status: "error",
      httpStatus: 400,
      message: "JSON inválido",
    });
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const result = await applyOneImportLead({
    repo,
    userId: endpoint.user_id,
    pipelineId: endpoint.pipeline_id,
    stageId: endpoint.stage_id ?? undefined,
    source: "inbound",
    row: inboundPayloadToInput(json),
    defaultKind: endpoint.lead_kind,
    formChannel: endpoint.channel,
  });
  if ("error" in result) {
    await persistInboundEvent(endpoint, {
      status: "error",
      httpStatus: result.status,
      message: result.error,
      json,
    });
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  await persistInboundEvent(endpoint, {
    status: result.created ? "created" : "skipped",
    httpStatus: result.created ? 201 : 200,
    message: result.created ? "Entrou" : "Já estava no quadro",
    dealId: result.deal.id,
    json,
  });
  return NextResponse.json(
    { deal_id: result.deal.id, created: result.created },
    { status: result.created ? 201 : 200 },
  );
}
