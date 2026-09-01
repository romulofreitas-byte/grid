import {
  canMoveFromFicha,
  callAdvanceTarget,
  dispositionAdvanceTarget,
  firstMileStages,
  isCrmStageKey,
  isFichaMoveKey,
  isPastFirstMile,
  leadStatusFromStageKey,
  type FichaMoveKey,
} from "@/lib/crm/cadence";
import { digitsCnpj, isCnpjOnlySearch, resolveCrmPipelineNome } from "@/lib/crm/bridge";
import type { LeadCrmFirstMileStage, LeadCrmState } from "@/lib/crm/types";
import type { GridRepo } from "@/lib/data/repo";
import type { LeadStatus, Search } from "@/lib/types";

export type LeadCrmRepo = Pick<
  GridRepo,
  | "listCrmPipelines"
  | "getCrmBoard"
  | "getPreset"
  | "findCrmDealByCnpjForUser"
  | "moveCrmDeal"
  | "updateCrmDeal"
>;

export function buildLeadCrmState(
  pipelineNome: string,
  deal: { id: string; pipeline_id: string; stage_id: string; notes: string },
  stages: Array<{
    id: string;
    nome: string;
    canonical_key: string | null;
  }>,
): LeadCrmState {
  const current = stages.find((stage) => stage.id === deal.stage_id);
  const stageKey = isCrmStageKey(current?.canonical_key)
    ? current.canonical_key
    : null;
  const firstMile: LeadCrmFirstMileStage[] = firstMileStages(stages).flatMap(
    (stage) => {
      if (!isFichaMoveKey(stage.canonical_key)) return [];
      return [
        {
          key: stage.canonical_key,
          id: stage.id,
          nome: stage.nome,
        },
      ];
    },
  );
  return {
    dealId: deal.id,
    pipelineId: deal.pipeline_id,
    pipelineNome,
    stageKey,
    stageNome: current?.nome ?? "",
    notes: deal.notes,
    firstMile,
    pastFirstMile: isPastFirstMile(stageKey),
  };
}

export async function preferredCrmPipelineId(
  repo: LeadCrmRepo,
  userId: string,
  search: Search | null,
): Promise<string | null> {
  if (!search) return null;
  const segmentId = search.filtros.segmentIds[0] ?? search.filtros.presetId;
  const preset = segmentId ? await repo.getPreset(segmentId) : null;
  const nome = resolveCrmPipelineNome({
    segmentNome: preset?.nome,
    intentQuery: search.filtros.intentQuery,
    searchNome: search.nome,
    cnpjOnly: isCnpjOnlySearch(search.filtros),
  });
  const pipelines = await repo.listCrmPipelines(userId);
  return (
    pipelines.find(
      (pipeline) => pipeline.nome.trim().toLowerCase() === nome.toLowerCase(),
    )?.id ?? null
  );
}

export async function loadLeadCrm(
  repo: LeadCrmRepo,
  input: { userId: string; cnpj: string; search: Search | null },
): Promise<LeadCrmState | null> {
  const preferred = await preferredCrmPipelineId(
    repo,
    input.userId,
    input.search,
  );
  const deal = await repo.findCrmDealByCnpjForUser(
    input.userId,
    digitsCnpj(input.cnpj),
    preferred,
  );
  if (!deal) return null;
  const board = await repo.getCrmBoard(input.userId, deal.pipeline_id);
  if (!board) return null;
  return buildLeadCrmState(board.pipeline.nome, deal, board.stages);
}

async function moveDealToKey(
  repo: LeadCrmRepo,
  userId: string,
  dealId: string,
  pipelineId: string,
  key: FichaMoveKey,
): Promise<LeadCrmState | null> {
  const board = await repo.getCrmBoard(userId, pipelineId);
  if (!board) return null;
  const target = board.stages.find((stage) => stage.canonical_key === key);
  if (!target) return null;
  const deal = await repo.moveCrmDeal(userId, dealId, target.id, 0);
  if (!deal) return null;
  return buildLeadCrmState(board.pipeline.nome, deal, board.stages);
}

export async function moveLeadCrmFromFicha(
  repo: LeadCrmRepo,
  input: {
    userId: string;
    cnpj: string;
    search: Search | null;
    targetKey: FichaMoveKey;
  },
): Promise<{ crm: LeadCrmState | null; status: LeadStatus | null }> {
  const crm = await loadLeadCrm(repo, input);
  if (!crm) return { crm: null, status: null };
  if (!canMoveFromFicha(crm.stageKey, input.targetKey)) {
    return { crm, status: leadStatusFromStageKey(crm.stageKey) };
  }
  const next = await moveDealToKey(
    repo,
    input.userId,
    crm.dealId,
    crm.pipelineId,
    input.targetKey,
  );
  return {
    crm: next,
    status: next ? leadStatusFromStageKey(next.stageKey) : null,
  };
}

export async function advanceCrmOnCall(
  repo: LeadCrmRepo,
  input: { userId: string; cnpj: string; search?: Search | null },
): Promise<LeadCrmState | null> {
  const crm = await loadLeadCrm(repo, {
    userId: input.userId,
    cnpj: input.cnpj,
    search: input.search ?? null,
  });
  if (!crm) return null;
  const target = callAdvanceTarget(crm.stageKey);
  if (!target) return crm;
  return moveDealToKey(
    repo,
    input.userId,
    crm.dealId,
    crm.pipelineId,
    target,
  );
}

export async function advanceCrmOnDisposition(
  repo: LeadCrmRepo,
  input: {
    userId: string;
    cnpj: string;
    status: LeadStatus;
    notes?: string;
  },
): Promise<LeadCrmState | null> {
  const crm = await loadLeadCrm(repo, {
    userId: input.userId,
    cnpj: input.cnpj,
    search: null,
  });
  if (!crm) return null;
  if (input.notes != null && input.notes !== crm.notes) {
    await repo.updateCrmDeal(input.userId, crm.dealId, { notes: input.notes });
  }
  const target = dispositionAdvanceTarget(input.status, crm.stageKey);
  if (!target) return crm;
  return moveDealToKey(
    repo,
    input.userId,
    crm.dealId,
    crm.pipelineId,
    target,
  );
}

export async function syncCrmDealNotes(
  repo: LeadCrmRepo,
  input: { userId: string; cnpj: string; search: Search | null; notes: string },
): Promise<void> {
  const crm = await loadLeadCrm(repo, input);
  if (!crm) return;
  await repo.updateCrmDeal(input.userId, crm.dealId, { notes: input.notes });
}
