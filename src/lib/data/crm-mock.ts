import { cloneDefaultCadence, DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import { planDeleteStage, insertAt } from "@/lib/crm/stages";
import type {
  CrmActivity,
  CrmActivityKind,
  CrmBoard,
  CrmDeal,
  CrmDealCard,
  CrmDealCreateInput,
  CrmDealPatch,
  CrmNextAction,
  CrmPipeline,
  CrmPipelineSummary,
  CrmStage,
} from "@/lib/crm/types";
import { getMockStore, type MockStore } from "@/lib/data/mock-store";

function nowIso(): string {
  return new Date().toISOString();
}

function id(): string {
  return crypto.randomUUID();
}

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function pipelinesOf(store: MockStore, userId: string): CrmPipeline[] {
  return store.crm_pipelines
    .filter((row) => row.user_id === userId)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

function stagesOf(store: MockStore, pipelineId: string): CrmStage[] {
  return store.crm_stages
    .filter((row) => row.pipeline_id === pipelineId)
    .sort((a, b) => a.position - b.position);
}

function openActivity(store: MockStore, dealId: string): CrmActivity | null {
  return (
    store.crm_activities.find(
      (row) => row.deal_id === dealId && row.status === "open",
    ) ?? null
  );
}

function toCard(store: MockStore, deal: CrmDeal): CrmDealCard {
  return { ...deal, next_activity: openActivity(store, deal.id) };
}

function ownPipeline(
  store: MockStore,
  userId: string,
  pipelineId: string,
): CrmPipeline | undefined {
  return store.crm_pipelines.find(
    (row) => row.id === pipelineId && row.user_id === userId,
  );
}

function ownDeal(
  store: MockStore,
  userId: string,
  dealId: string,
): CrmDeal | undefined {
  const deal = store.crm_deals.find((row) => row.id === dealId);
  if (!deal) return undefined;
  if (!ownPipeline(store, userId, deal.pipeline_id)) return undefined;
  return deal;
}

function compactStage(store: MockStore, stageId: string): void {
  store.crm_deals
    .filter((row) => row.stage_id === stageId)
    .sort((a, b) => a.position - b.position)
    .forEach((row, index) => {
      row.position = index;
    });
}

function moveDealInStore(
  store: MockStore,
  deal: CrmDeal,
  stageId: string,
  position: number,
): void {
  const fromStage = deal.stage_id;
  const siblings = store.crm_deals
    .filter((row) => row.stage_id === stageId && row.id !== deal.id)
    .sort((a, b) => a.position - b.position);
  const ordered = insertAt(siblings, position, deal);
  deal.stage_id = stageId;
  ordered.forEach((row, index) => {
    row.position = index;
  });
  if (fromStage !== stageId) compactStage(store, fromStage);
}

function closeOpenActivity(store: MockStore, dealId: string): void {
  for (const row of store.crm_activities) {
    if (row.deal_id === dealId && row.status === "open") {
      row.status = "done";
    }
  }
}

function insertActivity(
  store: MockStore,
  dealId: string,
  kind: CrmActivityKind,
  dueAt: string,
): CrmActivity {
  closeOpenActivity(store, dealId);
  const row: CrmActivity = {
    id: id(),
    deal_id: dealId,
    kind,
    due_at: dueAt,
    status: "open",
    created_at: nowIso(),
  };
  store.crm_activities.push(row);
  return row;
}

function createPipelineWithCadence(
  store: MockStore,
  userId: string,
  nome: string,
): CrmPipeline {
  const siblings = pipelinesOf(store, userId);
  const created = nowIso();
  const pipeline: CrmPipeline = {
    id: id(),
    user_id: userId,
    nome,
    position: siblings.length,
    created_at: created,
  };
  store.crm_pipelines.push(pipeline);
  cloneDefaultCadence().forEach((stageName, position) => {
    store.crm_stages.push({
      id: id(),
      pipeline_id: pipeline.id,
      nome: stageName,
      position,
      created_at: created,
    });
  });
  return pipeline;
}

function ensurePipelines(store: MockStore, userId: string): CrmPipeline[] {
  const existing = pipelinesOf(store, userId);
  if (existing.length > 0) return existing;
  return [createPipelineWithCadence(store, userId, DEFAULT_PIPELINE_NAME)];
}

function summarize(
  store: MockStore,
  pipeline: CrmPipeline,
): CrmPipelineSummary {
  return {
    ...pipeline,
    deal_count: store.crm_deals.filter((row) => row.pipeline_id === pipeline.id)
      .length,
  };
}

function assembleBoard(
  store: MockStore,
  pipeline: CrmPipeline,
): CrmBoard {
  return {
    pipeline,
    stages: stagesOf(store, pipeline.id),
    deals: store.crm_deals
      .filter((row) => row.pipeline_id === pipeline.id)
      .sort((a, b) => a.position - b.position)
      .map((deal) => toCard(store, deal)),
  };
}

export const crmMockMethods = {
  async listCrmPipelines(userId: string): Promise<CrmPipelineSummary[]> {
    const store = getMockStore();
    return ensurePipelines(store, userId).map((row) => summarize(store, row));
  },

  async getCrmBoard(
    userId: string,
    pipelineId: string,
  ): Promise<CrmBoard | null> {
    const store = getMockStore();
    const pipeline = ownPipeline(store, userId, pipelineId);
    if (!pipeline) return null;
    return assembleBoard(store, pipeline);
  },

  async createCrmPipeline(
    userId: string,
    nome: string,
  ): Promise<CrmPipeline> {
    return createPipelineWithCadence(getMockStore(), userId, nome);
  },

  async updateCrmPipeline(
    userId: string,
    pipelineId: string,
    patch: { nome?: string; position?: number },
  ): Promise<CrmPipeline | null> {
    const store = getMockStore();
    const pipeline = ownPipeline(store, userId, pipelineId);
    if (!pipeline) return null;
    if (patch.nome !== undefined) pipeline.nome = patch.nome;
    if (patch.position !== undefined) pipeline.position = patch.position;
    return pipeline;
  },

  async deleteCrmPipeline(
    userId: string,
    pipelineId: string,
  ): Promise<boolean> {
    const store = getMockStore();
    const owned = pipelinesOf(store, userId);
    if (owned.length <= 1) return false;
    const pipeline = ownPipeline(store, userId, pipelineId);
    if (!pipeline) return false;
    const dealIds = new Set(
      store.crm_deals
        .filter((row) => row.pipeline_id === pipelineId)
        .map((row) => row.id),
    );
    store.crm_activities = store.crm_activities.filter(
      (row) => !dealIds.has(row.deal_id),
    );
    store.crm_deals = store.crm_deals.filter(
      (row) => row.pipeline_id !== pipelineId,
    );
    store.crm_stages = store.crm_stages.filter(
      (row) => row.pipeline_id !== pipelineId,
    );
    store.crm_pipelines = store.crm_pipelines.filter(
      (row) => row.id !== pipelineId,
    );
    return true;
  },

  async createCrmStage(
    userId: string,
    pipelineId: string,
    nome: string,
  ): Promise<CrmStage | null> {
    const store = getMockStore();
    if (!ownPipeline(store, userId, pipelineId)) return null;
    const stages = stagesOf(store, pipelineId);
    const row: CrmStage = {
      id: id(),
      pipeline_id: pipelineId,
      nome,
      position: stages.length,
      created_at: nowIso(),
    };
    store.crm_stages.push(row);
    return row;
  },

  async updateCrmStage(
    userId: string,
    stageId: string,
    patch: { nome?: string; position?: number },
  ): Promise<CrmStage | null> {
    const store = getMockStore();
    const stage = store.crm_stages.find((row) => row.id === stageId);
    if (!stage || !ownPipeline(store, userId, stage.pipeline_id)) return null;
    if (patch.nome !== undefined) stage.nome = patch.nome;
    if (patch.position !== undefined) stage.position = patch.position;
    return stage;
  },

  async deleteCrmStage(
    userId: string,
    stageId: string,
    moveToStageId?: string | null,
  ): Promise<boolean> {
    const store = getMockStore();
    const stage = store.crm_stages.find((row) => row.id === stageId);
    if (!stage || !ownPipeline(store, userId, stage.pipeline_id)) return false;
    const stages = stagesOf(store, stage.pipeline_id);
    const dealCount = store.crm_deals.filter(
      (row) => row.stage_id === stageId,
    ).length;
    const plan = planDeleteStage({
      stages,
      stageId,
      dealCount,
      moveToStageId,
    });
    if (!plan.ok) return false;
    if (plan.moveToStageId) {
      const target = store.crm_deals.filter(
        (row) => row.stage_id === plan.moveToStageId,
      );
      let nextPos = target.length;
      for (const deal of store.crm_deals.filter((row) => row.stage_id === stageId)) {
        deal.stage_id = plan.moveToStageId;
        deal.position = nextPos;
        nextPos += 1;
      }
    }
    store.crm_stages = store.crm_stages.filter((row) => row.id !== stageId);
    stagesOf(store, stage.pipeline_id).forEach((row, index) => {
      row.position = index;
    });
    return true;
  },

  async reorderCrmStages(
    userId: string,
    pipelineId: string,
    stageIds: string[],
  ): Promise<boolean> {
    const store = getMockStore();
    if (!ownPipeline(store, userId, pipelineId)) return false;
    const stages = stagesOf(store, pipelineId);
    if (stages.length !== stageIds.length) return false;
    const known = new Set(stages.map((row) => row.id));
    if (stageIds.some((stageId) => !known.has(stageId))) return false;
    stageIds.forEach((stageId, position) => {
      const stage = store.crm_stages.find((row) => row.id === stageId);
      if (stage) stage.position = position;
    });
    return true;
  },

  async createCrmDeal(
    userId: string,
    input: CrmDealCreateInput,
  ): Promise<CrmDealCard | null> {
    const store = getMockStore();
    const pipeline = ownPipeline(store, userId, input.pipelineId);
    if (!pipeline) return null;
    const first = stagesOf(store, pipeline.id)[0];
    if (!first) return null;
    const position = store.crm_deals.filter(
      (row) => row.stage_id === first.id,
    ).length;
    const created = nowIso();
    const deal: CrmDeal = {
      id: id(),
      pipeline_id: pipeline.id,
      stage_id: first.id,
      company_name: input.company_name.trim(),
      contact_name: input.contact_name?.trim() ?? "",
      secretaries: cleanList(input.secretaries),
      phones: cleanList(input.phones),
      notes: input.notes?.trim() ?? "",
      position,
      created_at: created,
      updated_at: created,
    };
    store.crm_deals.push(deal);
    return toCard(store, deal);
  },

  async updateCrmDeal(
    userId: string,
    dealId: string,
    patch: CrmDealPatch,
  ): Promise<CrmDealCard | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    if (patch.company_name !== undefined) deal.company_name = patch.company_name;
    if (patch.contact_name !== undefined) deal.contact_name = patch.contact_name;
    if (patch.secretaries !== undefined) {
      deal.secretaries = cleanList(patch.secretaries);
    }
    if (patch.phones !== undefined) deal.phones = cleanList(patch.phones);
    if (patch.notes !== undefined) deal.notes = patch.notes;
    deal.updated_at = nowIso();
    return toCard(store, deal);
  },

  async moveCrmDeal(
    userId: string,
    dealId: string,
    stageId: string,
    position: number,
  ): Promise<CrmDealCard | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    const stage = store.crm_stages.find((row) => row.id === stageId);
    if (!stage || stage.pipeline_id !== deal.pipeline_id) return null;
    moveDealInStore(store, deal, stageId, position);
    deal.updated_at = nowIso();
    return toCard(store, deal);
  },

  async deleteCrmDeal(userId: string, dealId: string): Promise<boolean> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return false;
    store.crm_activities = store.crm_activities.filter(
      (row) => row.deal_id !== dealId,
    );
    store.crm_deals = store.crm_deals.filter((row) => row.id !== dealId);
    compactStage(store, deal.stage_id);
    return true;
  },

  async scheduleCrmActivity(
    userId: string,
    dealId: string,
    kind: CrmActivityKind,
    dueAt: string,
  ): Promise<CrmDealCard | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    insertActivity(store, dealId, kind, dueAt);
    deal.updated_at = nowIso();
    return toCard(store, deal);
  },

  async logCrmCall(
    userId: string,
    dealId: string,
    notes: string,
    next?: CrmNextAction | null,
  ): Promise<CrmDealCard | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    deal.notes = notes;
    closeOpenActivity(store, dealId);
    if (next) insertActivity(store, dealId, next.kind, next.dueAt);
    deal.updated_at = nowIso();
    return toCard(store, deal);
  },
};
