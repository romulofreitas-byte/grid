import { crmAllowed } from "@/lib/billing/service";
import { digitsCnpj } from "@/lib/crm/bridge";
import {
  advanceCrmOnCall,
  preferredCrmPipelineId,
  type LeadCrmRepo,
} from "@/lib/crm/lead-sync";
import { openLigarActivity } from "@/lib/crm/activity";
import { normalizeCallId } from "@/lib/crm/events";
import type { CrmDealCard, CrmEvent, CrmNextAction } from "@/lib/crm/types";
import type { GridRepo } from "@/lib/data/repo";
import type { CallEventSource, CallOutcome, Search } from "@/lib/types";

export type RecordCompletedCallRepo = LeadCrmRepo &
  Pick<
    GridRepo,
    | "recordCallEvent"
    | "updateCallEventOutcome"
    | "updateLead"
    | "findSavedLeadForOutcome"
    | "findCrmDealByCnpjForUser"
    | "getCrmDeal"
    | "logCrmCall"
    | "completeCrmActivity"
    | "updateCrmEvent"
    | "listCrmEvents"
  >;

export type RecordCompletedCallInput = {
  userId: string;
  cnpj: string;
  savedLeadId?: string | null;
  search?: Search | null;
  source: CallEventSource;
  outcome?: CallOutcome;
  notes?: string;
  next?: CrmNextAction | null;
  phone?: string;
  dealId?: string;
  /** Caller already wrote crm_events (complete / logCrmCall / createCrmEvent). */
  crmEventAlreadyWritten?: boolean;
  /** Skip getBalance; CRM routes already gated. */
  crmWrites?: boolean;
  /**
   * VoIP originate counts the ring and leaves the Box `ligar` open.
   * The history row is still written so the decisor mark is on the card.
   */
  completeOpenLigar?: boolean;
  /** API4COM call id stamped on the ligar history row. */
  callId?: string;
  /** UUID sent to API4COM, so the recording can find this row. */
  callRef?: string | null;
};

export async function recordCompletedCall(
  repo: RecordCompletedCallRepo,
  input: RecordCompletedCallInput,
): Promise<{ counted: boolean }> {
  const cnpj = digitsCnpj(input.cnpj);
  let savedLeadId = input.savedLeadId ?? null;
  if (!savedLeadId) {
    const lead = await repo.findSavedLeadForOutcome(input.userId, {
      cnpj,
      searchId: input.search?.id ?? null,
    });
    savedLeadId = lead?.id ?? null;
  }

  const outcome: CallOutcome = input.outcome === "decisor" ? "decisor" : "discagem";
  const callEventId = await repo.recordCallEvent(input.userId, {
    cnpj,
    savedLeadId,
    source: input.source,
    outcome,
  });
  const counted = Boolean(callEventId);

  if (savedLeadId) {
    await repo.updateLead(savedLeadId, { status: "ligando" });
  }

  const mayWriteCrm =
    input.crmWrites ?? (await crmAllowed(input.userId));
  if (!mayWriteCrm) return { counted };

  try {
    if (!input.crmEventAlreadyWritten) {
      const deal = input.dealId
        ? await repo.getCrmDeal(input.userId, input.dealId)
        : await repo.findCrmDealByCnpjForUser(
            input.userId,
            cnpj,
            await preferredCrmPipelineId(
              repo,
              input.userId,
              input.search ?? null,
            ),
          );
      if (deal) {
        const ligar = openLigarActivity(deal);
        const written =
          ligar && input.completeOpenLigar !== false
            ? await repo.completeCrmActivity(
                input.userId,
                deal.id,
                ligar.id,
                input.callId,
                input.phone,
              )
            : await repo.logCrmCall(
                input.userId,
                deal.id,
                input.notes ?? "",
                input.next ?? null,
                input.phone,
                input.callId,
              );
        await stampCallOnEvent(
          repo,
          input.userId,
          deal.id,
          written?.event,
          outcome,
          callEventId,
          input.callRef,
        );
      }
    }
    await advanceCrmOnCall(repo, {
      userId: input.userId,
      cnpj,
      search: input.search ?? null,
      outcome,
    });
  } catch {
    // Ring still counts if the CRM card cannot move.
  }

  return { counted };
}

async function stampCallOnEvent(
  repo: RecordCompletedCallRepo,
  userId: string,
  dealId: string,
  event: CrmEvent | null | undefined,
  outcome: CallOutcome,
  callEventId: string | null,
  callRef?: string | null,
): Promise<void> {
  if (!event) return;
  const ref = normalizeCallId(callRef);
  if (!callEventId && !ref) return;
  const meta: CrmEvent["meta"] = {};
  if (callEventId) {
    meta.call_outcome = outcome;
    meta.call_event_id = callEventId;
  }
  if (ref) meta.call_ref = ref;
  await repo.updateCrmEvent(userId, dealId, event.id, event.body, meta, false);
}

/** Switches one history row between discagem and decisor. The dial stays a single row. */
export async function reclassifyCrmCall(
  repo: RecordCompletedCallRepo,
  input: {
    userId: string;
    dealId: string;
    eventId: string;
    outcome: CallOutcome;
  },
): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
  const events = await repo.listCrmEvents(input.userId, input.dealId);
  const event = events?.find((row) => row.id === input.eventId);
  const callEventId =
    event?.kind === "ligar" ? event.meta.call_event_id : undefined;
  if (!event || !callEventId) return null;
  const outcome: CallOutcome = input.outcome === "decisor" ? "decisor" : "discagem";
  const updated = await repo.updateCallEventOutcome(
    input.userId,
    callEventId,
    outcome,
  );
  if (!updated) return null;
  const saved = await repo.updateCrmEvent(
    input.userId,
    input.dealId,
    event.id,
    event.body,
    { call_outcome: outcome },
    false,
  );
  if (!saved) return null;
  if (outcome !== "decisor") return saved;
  const cnpj = saved.deal.cnpj;
  if (cnpj) {
    try {
      await advanceCrmOnCall(repo, {
        userId: input.userId,
        cnpj,
        outcome: "decisor",
      });
    } catch {
      return saved;
    }
  }
  const deal = await repo.getCrmDeal(input.userId, input.dealId);
  return { deal: deal ?? saved.deal, event: saved.event };
}

/** After a CRM write that already created a `ligar` event. */
export async function countConfirmedCrmCall(
  repo: RecordCompletedCallRepo,
  userId: string,
  deal: { id: string; cnpj: string | null },
  eventKind: string,
): Promise<void> {
  if (eventKind !== "ligar" || !deal.cnpj) return;
  await recordCompletedCall(repo, {
    userId,
    cnpj: deal.cnpj,
    dealId: deal.id,
    source: "crm",
    crmEventAlreadyWritten: true,
    crmWrites: true,
  });
}
