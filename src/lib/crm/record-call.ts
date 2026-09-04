import { crmAllowed } from "@/lib/billing/service";
import { digitsCnpj } from "@/lib/crm/bridge";
import {
  advanceCrmOnCall,
  preferredCrmPipelineId,
  type LeadCrmRepo,
} from "@/lib/crm/lead-sync";
import type { CrmNextAction } from "@/lib/crm/types";
import type { GridRepo } from "@/lib/data/repo";
import type { CallEventSource, Search } from "@/lib/types";

export type RecordCompletedCallRepo = LeadCrmRepo &
  Pick<
    GridRepo,
    | "recordCallEvent"
    | "updateLead"
    | "findSavedLeadForOutcome"
    | "findCrmDealByCnpjForUser"
    | "getCrmDeal"
    | "logCrmCall"
    | "completeCrmActivity"
  >;

export type RecordCompletedCallInput = {
  userId: string;
  cnpj: string;
  savedLeadId?: string | null;
  search?: Search | null;
  source: CallEventSource;
  notes?: string;
  next?: CrmNextAction | null;
  phone?: string;
  dealId?: string;
  /** Caller already wrote crm_events (complete / logCrmCall / createCrmEvent). */
  crmEventAlreadyWritten?: boolean;
  /** Skip getBalance; CRM routes already gated. */
  crmWrites?: boolean;
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

  const counted = await repo.recordCallEvent(input.userId, {
    cnpj,
    savedLeadId,
    source: input.source,
  });

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
        if (deal.next_activity?.kind === "ligar") {
          await repo.completeCrmActivity(input.userId, deal.id);
        } else {
          await repo.logCrmCall(
            input.userId,
            deal.id,
            input.notes ?? "",
            input.next ?? null,
            input.phone,
          );
        }
      }
    }
    await advanceCrmOnCall(repo, {
      userId: input.userId,
      cnpj,
      search: input.search ?? null,
    });
  } catch {
    // Ring still counts if the CRM card cannot move.
  }

  return { counted };
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
