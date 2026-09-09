import {
  isCnpjOnlySearch,
  resolveCrmPipelineNome,
} from "@/lib/crm/bridge";
import { pickEntradaStage } from "@/lib/crm/cadence";
import type { CrmDealTransferResult } from "@/lib/crm/transfer";
import type {
  CrmBoard,
  CrmDealSource,
  CrmInboundEndpoint,
  CrmOutcome,
  CrmPipelineSummary,
} from "@/lib/crm/types";
import type { NichePreset, Search } from "@/lib/types";

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

export type PipelineRemovalTransferReason =
  | "advanced"
  | "user_owned"
  | "inbound"
  | "last";

export function pipelineRemovalTransferReason(
  preview: PipelineRemovalPreview,
): PipelineRemovalTransferReason | null {
  if (preview.canDeleteDirectly) return null;
  if (preview.isLastPipeline) return "last";
  if (preview.advancedCount > 0) return "advanced";
  if (preview.userOwnedCount > 0) return "user_owned";
  if (preview.inboundCount > 0) return "inbound";
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
  const canDeleteDirectly =
    !input.isLastPipeline &&
    input.inboundCount === 0 &&
    userOwnedCount === 0 &&
    advancedCount === 0;
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
  segmentNomeById: Map<string, string>,
): number {
  const needle = pipelineNome.trim().toLowerCase();
  if (!needle) return 0;
  return searches.filter((search) => {
    if (!search.saved) return false;
    const segmentId = search.filtros.segmentIds[0] ?? search.filtros.presetId;
    const segmentNome = segmentId ? segmentNomeById.get(segmentId) : undefined;
    const resolved = resolveCrmPipelineNome({
      segmentNome,
      intentQuery: search.filtros.intentQuery,
      searchNome: search.nome,
      cnpjOnly: isCnpjOnlySearch(search.filtros) && !segmentNome,
    });
    return resolved.trim().toLowerCase() === needle;
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
  getPreset: (id: string) => Promise<NichePreset | undefined>;
  transferCrmDeal: (
    userId: string,
    dealId: string,
    toPipelineId: string,
  ) => Promise<CrmDealTransferResult | null>;
  updateCrmInboundEndpoint: (
    userId: string,
    endpointId: string,
    input: { pipelineId?: string; stage_id?: string | null },
  ) => Promise<CrmInboundEndpoint | null>;
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
  const segmentIds = [
    ...new Set(
      searches.flatMap((search) => {
        const id = search.filtros.segmentIds[0] ?? search.filtros.presetId;
        return id ? [id] : [];
      }),
    ),
  ];
  const segmentNomeById = new Map<string, string>();
  await Promise.all(
    segmentIds.map(async (id) => {
      const preset = await repo.getPreset(id);
      if (preset) segmentNomeById.set(id, preset.nome);
    }),
  );
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
      segmentNomeById,
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
      status: 400 | 404 | 409;
      error: string;
      preview?: PipelineRemovalPreview;
    };

export async function executePipelineRemoval(
  repo: PipelineRemovalRepo,
  userId: string,
  pipelineId: string,
  transferToPipelineId?: string | null,
): Promise<PipelineRemovalResult> {
  const preview = await loadPipelineRemovalPreview(repo, userId, pipelineId);
  if (!preview) {
    return { ok: false, status: 404, error: "Nicho não encontrado." };
  }
  if (preview.isLastPipeline) {
    return { ok: false, status: 400, error: "Não dá para excluir o último nicho." };
  }
  if (transferToPipelineId) {
    if (transferToPipelineId === pipelineId) {
      return { ok: false, status: 400, error: "Escolha outro nicho." };
    }
    const pipelines = await repo.listCrmPipelines(userId);
    if (!pipelines.some((row) => row.id === transferToPipelineId)) {
      return { ok: false, status: 404, error: "Nicho de destino não encontrado." };
    }
    const board = await repo.getCrmBoard(userId, pipelineId);
    if (!board) {
      return { ok: false, status: 404, error: "Nicho não encontrado." };
    }
    for (const deal of board.deals) {
      const moved = await repo.transferCrmDeal(
        userId,
        deal.id,
        transferToPipelineId,
      );
      if (!moved) {
        return {
          ok: false,
          status: 400,
          error: "Não foi possível transferir todos os negócios.",
        };
      }
    }
    const destBoard = await repo.getCrmBoard(userId, transferToPipelineId);
    const entradaId = destBoard
      ? pickEntradaStage(destBoard.stages)?.id ?? null
      : null;
    const inbound = await repo.listCrmInboundEndpoints(userId);
    for (const endpoint of inbound.filter(
      (row) => row.pipeline_id === pipelineId,
    )) {
      const updated = await repo.updateCrmInboundEndpoint(userId, endpoint.id, {
        pipelineId: transferToPipelineId,
        stage_id: entradaId,
      });
      if (!updated) {
        return {
          ok: false,
          status: 400,
          error: "Não foi possível mover as automações deste nicho.",
        };
      }
    }
    const deleted = await repo.deleteCrmPipeline(userId, pipelineId);
    if (!deleted) {
      return { ok: false, status: 400, error: "Não deu para excluir o nicho." };
    }
    return { ok: true, pipelines: await repo.listCrmPipelines(userId) };
  }
  if (!preview.canDeleteDirectly) {
    return {
      ok: false,
      status: 409,
      error: "Transfira os negócios para outro nicho antes de excluir.",
      preview,
    };
  }
  const deleted = await repo.deleteCrmPipeline(userId, pipelineId);
  if (!deleted) {
    return { ok: false, status: 400, error: "Não dá para excluir o último nicho." };
  }
  return { ok: true, pipelines: await repo.listCrmPipelines(userId) };
}

