import {
  dealMatchesImportLead,
  mapImportLead,
  type ImportLeadInput,
} from "@/lib/crm/import";
import { IMPORT_SKIPPED_MESSAGE } from "@/lib/crm/import-history";
import {
  IMPORT_CREATE_FAILED_MESSAGE,
  IMPORT_EMPTY_ROW_MESSAGE,
} from "@/lib/crm/import-issues";
import type {
  CrmDealCard,
  CrmDealCreateInput,
  CrmDealSource,
  CrmFormChannel,
  CrmImportRunIssueStatus,
  CrmLeadKind,
} from "@/lib/crm/types";

export type ImportApplyRepo = {
  getCrmBoard(
    userId: string,
    pipelineId: string,
  ): Promise<{ deals: CrmDealCard[] } | null>;
  createCrmDeals(
    userId: string,
    inputs: CrmDealCreateInput[],
  ): Promise<(CrmDealCard | null)[]>;
};

export type ImportRowError = {
  row: number;
  message: string;
};

export type ImportRowIssue = ImportRowError & {
  status: CrmImportRunIssueStatus;
};

export type ImportApplyResult = {
  created: number;
  skipped: number;
  errors: ImportRowError[];
  issues: ImportRowIssue[];
  deals: Array<{ id: string; created: boolean }>;
};

export async function applyImportLeads(opts: {
  repo: ImportApplyRepo;
  userId: string;
  pipelineId: string;
  stageId?: string;
  source: Extract<CrmDealSource, "import" | "inbound">;
  rows: ImportLeadInput[];
  defaultKind?: CrmLeadKind;
  formChannel?: CrmFormChannel;
  searchId?: string;
  existingDeals?: CrmDealCard[];
}): Promise<ImportApplyResult | { error: string; status: number }> {
  let known: CrmDealCard[];
  if (opts.existingDeals) {
    known = [...opts.existingDeals];
  } else {
    const board = await opts.repo.getCrmBoard(opts.userId, opts.pipelineId);
    if (!board) return { error: "Pista não encontrada.", status: 404 };
    known = [...board.deals];
  }

  const result: ImportApplyResult = {
    created: 0,
    skipped: 0,
    errors: [],
    issues: [],
    deals: [],
  };

  function pushError(row: number, message: string) {
    result.errors.push({ row, message });
    result.issues.push({ row, status: "error", message });
  }

  const pending: Array<{
    row: number;
    input: CrmDealCreateInput;
    stub: Pick<CrmDealCard, "id" | "cnpj" | "phones" | "people">;
  }> = [];

  for (let index = 0; index < opts.rows.length; index += 1) {
    const mapped = mapImportLead(opts.rows[index]!, {
      kind: opts.defaultKind,
    });
    if (!mapped.ok) {
      if (mapped.message === IMPORT_EMPTY_ROW_MESSAGE) continue;
      pushError(index + 1, mapped.message);
      continue;
    }
    const existing = known.find((deal) =>
      dealMatchesImportLead(deal, mapped.lead),
    );
    if (existing) {
      result.skipped += 1;
      result.deals.push({ id: existing.id, created: false });
      result.issues.push({
        row: index + 1,
        status: "skipped",
        message: IMPORT_SKIPPED_MESSAGE,
      });
      continue;
    }
    const stub = {
      id: `pending-${index}`,
      cnpj: mapped.lead.cnpj ?? null,
      phones: mapped.lead.phones,
      people: mapped.lead.people,
    };
    known.push(stub as CrmDealCard);
    pending.push({
      row: index + 1,
      stub,
      input: {
        pipelineId: opts.pipelineId,
        stage_id: opts.stageId,
        company_name: mapped.lead.company_name,
        contact_name: mapped.lead.contact_name,
        people: mapped.lead.people,
        phones: mapped.lead.phones,
        notes: mapped.lead.notes || undefined,
        cnpj: mapped.lead.cnpj,
        meta: {
          source: opts.source,
          lead_kind: mapped.lead.kind,
          form_answers: mapped.lead.answers,
          form_channel: opts.formChannel,
          searchId: opts.searchId,
        },
      },
    });
  }

  const created =
    pending.length === 0
      ? []
      : await opts.repo.createCrmDeals(
          opts.userId,
          pending.map((item) => item.input),
        );

  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index]!;
    const card = created[index] ?? null;
    if (!card) {
      pushError(item.row, IMPORT_CREATE_FAILED_MESSAGE);
      continue;
    }
    result.created += 1;
    result.deals.push({ id: card.id, created: true });
  }

  return result;
}

export type ApplyOneLeadResult = {
  deal: { id: string };
  created: boolean;
};

export async function applyOneImportLead(opts: {
  repo: ImportApplyRepo;
  userId: string;
  pipelineId: string;
  stageId?: string;
  source: Extract<CrmDealSource, "import" | "inbound">;
  row: ImportLeadInput;
  defaultKind?: CrmLeadKind;
  formChannel?: CrmFormChannel;
}): Promise<
  | ApplyOneLeadResult
  | { error: string; status: number }
> {
  const mapped = mapImportLead(opts.row, { kind: opts.defaultKind });
  if (!mapped.ok) return { error: mapped.message, status: 400 };
  const batch = await applyImportLeads({
    repo: opts.repo,
    userId: opts.userId,
    pipelineId: opts.pipelineId,
    stageId: opts.stageId,
    source: opts.source,
    rows: [opts.row],
    defaultKind: opts.defaultKind,
    formChannel: opts.formChannel,
  });
  if ("error" in batch) return batch;
  const first = batch.deals[0];
  if (!first) {
    return {
      error: batch.errors[0]?.message ?? "Payload inválido",
      status: 400,
    };
  }
  return { deal: { id: first.id }, created: first.created };
}
