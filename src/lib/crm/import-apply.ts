import {
  dealMatchesImportLead,
  mapImportLead,
  type ImportLeadInput,
} from "@/lib/crm/import";
import type {
  CrmDealCard,
  CrmDealCreateInput,
  CrmDealSource,
} from "@/lib/crm/types";

export type ImportApplyRepo = {
  getCrmBoard(
    userId: string,
    pipelineId: string,
  ): Promise<{ deals: CrmDealCard[] } | null>;
  createCrmDeal(
    userId: string,
    input: CrmDealCreateInput,
  ): Promise<CrmDealCard | null>;
};

export type ImportRowError = {
  row: number;
  message: string;
};

export type ImportApplyResult = {
  created: number;
  skipped: number;
  errors: ImportRowError[];
  deals: Array<{ id: string; created: boolean }>;
};

export async function applyImportLeads(opts: {
  repo: ImportApplyRepo;
  userId: string;
  pipelineId: string;
  stageId?: string;
  source: Extract<CrmDealSource, "import" | "inbound">;
  rows: ImportLeadInput[];
}): Promise<ImportApplyResult | { error: string; status: number }> {
  const board = await opts.repo.getCrmBoard(opts.userId, opts.pipelineId);
  if (!board) return { error: "Pista não encontrada.", status: 404 };

  const known: CrmDealCard[] = [...board.deals];
  const result: ImportApplyResult = {
    created: 0,
    skipped: 0,
    errors: [],
    deals: [],
  };

  for (let index = 0; index < opts.rows.length; index += 1) {
    const mapped = mapImportLead(opts.rows[index]!);
    if (!mapped.ok) {
      result.errors.push({ row: index + 1, message: mapped.message });
      continue;
    }
    const existing = known.find((deal) =>
      dealMatchesImportLead(deal, mapped.lead),
    );
    if (existing) {
      result.skipped += 1;
      result.deals.push({ id: existing.id, created: false });
      continue;
    }
    const created = await opts.repo.createCrmDeal(opts.userId, {
      pipelineId: opts.pipelineId,
      stage_id: opts.stageId,
      company_name: mapped.lead.company_name,
      contact_name: mapped.lead.contact_name,
      people: mapped.lead.people,
      phones: mapped.lead.phones,
      notes: mapped.lead.notes || undefined,
      cnpj: mapped.lead.cnpj,
      meta: { source: opts.source },
    });
    if (!created) {
      result.errors.push({
        row: index + 1,
        message: "Não foi possível criar o negócio.",
      });
      continue;
    }
    known.push(created);
    result.created += 1;
    result.deals.push({ id: created.id, created: true });
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
}): Promise<
  | ApplyOneLeadResult
  | { error: string; status: number }
> {
  const mapped = mapImportLead(opts.row);
  if (!mapped.ok) return { error: mapped.message, status: 400 };
  const batch = await applyImportLeads({
    repo: opts.repo,
    userId: opts.userId,
    pipelineId: opts.pipelineId,
    stageId: opts.stageId,
    source: opts.source,
    rows: [opts.row],
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
