import { pipelineSeriesRank } from "@/lib/crm/bridge";
import type {
  CrmBoard,
  CrmDealSource,
  CrmInboundEndpoint,
  CrmOutcome,
  CrmPipelineSummary,
} from "@/lib/crm/types";
import type { Search } from "@/lib/types";

export const USER_OWNED_DEAL_SOURCES: readonly CrmDealSource[] = [
  "import",
  "inbound",
  "crm_add",
];

export const GRID_DEAL_SOURCES: readonly CrmDealSource[] = [
  "qualify_bridge",
  "catchup_bridge",
];

export type PipelineRemovalDeal = {
  outcome: CrmOutcome;
  source?: CrmDealSource;
  searchId?: string;
  canonicalKey: string | null;
};

export type PipelineRemovalPreview = {
  canDeleteDirectly: boolean;
  isLastPipeline: boolean;
  dealCount: number;
  entradaCount: number;
  advancedCount: number;
  userOwnedCount: number;
  inboundCount: number;
  matchingSavedListCount: number;
};

export type PipelineRemovalTransferReason = "last";

export function pipelineRemovalTransferReason(
  preview: PipelineRemovalPreview,
): PipelineRemovalTransferReason | null {
  if (preview.isLastPipeline) return "last";
  return null;
}

export function isUserOwnedDealSource(
  source: CrmDealSource | undefined,
): boolean {
  return Boolean(source && USER_OWNED_DEAL_SOURCES.includes(source));
}

export function isGridDealSource(source: CrmDealSource | undefined): boolean {
  return !isUserOwnedDealSource(source);
}

export function isEntradaOpenDeal(deal: PipelineRemovalDeal): boolean {
  return deal.outcome === "open" && deal.canonicalKey === "entrada";
}

export function isAdvancedDeal(deal: PipelineRemovalDeal): boolean {
  return !isEntradaOpenDeal(deal);
}

export function summarizePipelineRemoval(input: {
  isLastPipeline: boolean;
  inboundCount: number;
  matchingSavedListCount: number;
  deals: PipelineRemovalDeal[];
}): PipelineRemovalPreview {
  let entradaCount = 0;
  let advancedCount = 0;
  let userOwnedCount = 0;
  for (const deal of input.deals) {
    if (isUserOwnedDealSource(deal.source)) userOwnedCount += 1;
    if (isAdvancedDeal(deal)) advancedCount += 1;
    else entradaCount += 1;
  }
  const canDeleteDirectly = !input.isLastPipeline;
  return {
    canDeleteDirectly,
    isLastPipeline: input.isLastPipeline,
    dealCount: input.deals.length,
    entradaCount,
    advancedCount,
    userOwnedCount,
    inboundCount: input.inboundCount,
    matchingSavedListCount: input.matchingSavedListCount,
  };
}

export function matchingSavedListCount(
  searches: Search[],
  pipelineNome: string,
): number {
  if (!pipelineNome.trim()) return 0;
  return searches.filter((search) => {
    if (!search.saved) return false;
    return pipelineSeriesRank(pipelineNome, search.nome) != null;
  }).length;
}

export function shouldRemoveEntradaDeal(deal: {
  searchId?: string;
  source?: CrmDealSource;
  outcome: CrmOutcome;
  canonicalKey: string | null;
  listSearchId: string;
}): boolean {
  if (deal.searchId !== deal.listSearchId) return false;
  if (!isGridDealSource(deal.source)) return false;
  return isEntradaOpenDeal(deal);
}

export type PipelineRemovalRepo = {
  listCrmPipelines: (userId: string) => Promise<CrmPipelineSummary[]>;
  getCrmBoard: (userId: string, pipelineId: string) => Promise<CrmBoard | null>;
  listCrmInboundEndpoints: (userId: string) => Promise<CrmInboundEndpoint[]>;
  listRecentSearches: (
    userId: string,
    opts?: { limit?: number; saved?: boolean },
  ) => Promise<Search[]>;
  deleteCrmPipeline: (userId: string, pipelineId: string) => Promise<boolean>;
};

export async function loadPipelineRemovalPreview(
  repo: PipelineRemovalRepo,
  userId: string,
  pipelineId: string,
): Promise<PipelineRemovalPreview | null> {
  const [pipelines, board, inbound] = await Promise.all([
    repo.listCrmPipelines(userId),
    repo.getCrmBoard(userId, pipelineId),
    repo.listCrmInboundEndpoints(userId),
  ]);
  if (!board) return null;
  const searches = await repo.listRecentSearches(userId, { saved: true });
  const stageById = new Map(
    board.stages.map((stage) => [stage.id, stage] as const),
  );
  return summarizePipelineRemoval({
    isLastPipeline: pipelines.length <= 1,
    inboundCount: inbound.filter((row) => row.pipeline_id === pipelineId)
      .length,
    matchingSavedListCount: matchingSavedListCount(
      searches,
      board.pipeline.nome,
    ),
    deals: board.deals.map((deal) => ({
      outcome: deal.outcome,
      source: deal.meta.source,
      searchId: deal.meta.searchId,
      canonicalKey: stageById.get(deal.stage_id)?.canonical_key ?? null,
    })),
  });
}

export type PipelineRemovalResult =
  | { ok: true; pipelines: CrmPipelineSummary[] }
  | {
      ok: false;
      status: 400 | 404;
      error: string;
      preview?: PipelineRemovalPreview;
    };

export async function executePipelineRemoval(
  repo: PipelineRemovalRepo,
  userId: string,
  pipelineId: string,
): Promise<PipelineRemovalResult> {
  const preview = await loadPipelineRemovalPreview(repo, userId, pipelineId);
  if (!preview) {
    return { ok: false, status: 404, error: "Nicho não encontrado." };
  }
  if (preview.isLastPipeline) {
    return { ok: false, status: 400, error: "Não dá para excluir o último nicho." };
  }
  const deleted = await repo.deleteCrmPipeline(userId, pipelineId);
  if (!deleted) {
    return { ok: false, status: 400, error: "Não dá para excluir o último nicho." };
  }
  return { ok: true, pipelines: await repo.listCrmPipelines(userId) };
}

