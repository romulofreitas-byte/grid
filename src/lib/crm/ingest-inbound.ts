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
import type { CrmInboundEndpoint } from "@/lib/crm/types";
import { getRepo } from "@/lib/data";

export async function persistInboundEvent(
  endpoint: CrmInboundEndpoint,
  input: {
    status: "created" | "skipped" | "error";
    httpStatus: number;
    message: string;
    dealId?: string | null;
    json?: unknown;
    externalId?: string | null;
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
      externalId: input.externalId ?? null,
    });
  } catch (err) {
    console.error("inbound_event_persist_error", err);
  }
}

export async function ingestInboundJson(
  endpoint: CrmInboundEndpoint,
  json: unknown,
  opts?: { externalId?: string | null },
): Promise<NextResponse> {
  const repo = getRepo();
  const owner = await getBalance(endpoint.user_id);
  if (!planHasFeature(owner.plano, "automations")) {
    await persistInboundEvent(endpoint, {
      status: "error",
      httpStatus: 403,
      message: AUTOMATIONS_NOT_ALLOWED_MESSAGE,
      json,
      externalId: opts?.externalId,
    });
    return NextResponse.json(planRequiredPayload(AUTOMATIONS_NOT_ALLOWED_MESSAGE), {
      status: 403,
    });
  }

  if (opts?.externalId) {
    const prior = await repo.findCrmInboundEventByExternalId(
      endpoint.id,
      opts.externalId,
    );
    if (prior?.deal_id) {
      return NextResponse.json(
        { deal_id: prior.deal_id, created: false },
        { status: 200 },
      );
    }
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
      externalId: opts?.externalId,
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
    externalId: opts?.externalId,
  });
  return NextResponse.json(
    { deal_id: result.deal.id, created: result.created },
    { status: result.created ? 201 : 200 },
  );
}
