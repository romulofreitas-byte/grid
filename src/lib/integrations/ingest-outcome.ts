import type { LeadStatus } from "@/lib/types";
import { getRepo } from "@/lib/data";
import type { IntegrationConnectionRecord } from "./records";
import { dispositionToLeadStatus } from "./outcomes";

export async function ingestCallOutcome(input: {
  connection: IntegrationConnectionRecord;
  eventType: string;
  cnpj?: string;
  e164?: string;
  disposition: string;
  notes?: string;
  durationSec?: number;
  externalId?: string;
  /** VoIP hangup only confirms the call — never reunião/descarte. */
  forceStatus?: LeadStatus | null;
}): Promise<{ ok: true; status: LeadStatus | null; matched: boolean }> {
  const repo = getRepo();
  const status =
    input.forceStatus !== undefined
      ? input.forceStatus
      : dispositionToLeadStatus(input.disposition);
  const lead = await repo.findSavedLeadForOutcome(input.connection.user_id, {
    cnpj: input.cnpj,
    e164: input.e164,
  });

  if (lead && status) {
    await repo.updateLead(lead.id, {
      status,
      ...(input.notes ? { notas: input.notes } : {}),
    });
  }

  await repo.insertIntegrationEvent({
    user_id: input.connection.user_id,
    connection_id: input.connection.id,
    job_id: null,
    direction: "inbound",
    event_type: input.eventType,
    cnpj: input.cnpj ?? lead?.cnpj ?? null,
    e164: input.e164 ?? null,
    external_id: input.externalId ?? null,
    disposition: input.disposition,
    lead_status: status,
    payload_summary: {
      duration_sec: input.durationSec ?? null,
      matched: Boolean(lead),
    },
  });

  return { ok: true, status, matched: Boolean(lead) };
}
