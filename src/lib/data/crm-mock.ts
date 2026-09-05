import { digitsCnpj } from "@/lib/crm/bridge";
import { cloneDefaultCadenceEntries, pickCreateStage } from "@/lib/crm/cadence";
import {
  briefingPresenceFromFields,
  type CrmBriefingLookup,
} from "@/lib/crm/briefing";
import {
  canSearchDeals,
  clampDealSearchLimit,
  dealMatchesSearch,
  rankDealSearchHits,
  toDealSearchHit,
} from "@/lib/crm/deal-search";
import { uniquePhones } from "@/lib/crm/dial";
import { CRM_EVENT_HISTORY_LIMIT } from "@/lib/crm/events";
import { peopleFromDeal, sanitizePeople, snapshotContactName } from "@/lib/crm/people";
import { planDeleteStage, insertAt } from "@/lib/crm/stages";
import { isEnrichmentVisible } from "@/lib/enrichment/fresh";
import { formatPhone } from "@/lib/format";
import type {
  CrmActivity,
  CrmActivityKind,
  CrmBoard,
  CrmDeal,
  CrmDealCard,
  CrmDealCreateInput,
  CrmDealPatch,
  CrmDealSearchHit,
  CrmEvent,
  CrmEventCreateInput,
  CrmEventKind,
  CrmInboundEndpoint,
  CrmNextAction,
  CrmOutcome,
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
    store.crm_activities
      .filter((row) => row.deal_id === dealId && row.status === "open")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

function toCard(store: MockStore, deal: CrmDeal): CrmDealCard {
  if (!deal.people) {
    deal.people = peopleFromDeal(deal);
  }
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

function insertEvent(
  store: MockStore,
  dealId: string,
  kind: CrmEventKind,
  body: string,
  meta: CrmEvent["meta"] = {},
): CrmEvent {
  const now = nowIso();
  const row: CrmEvent = {
    id: id(),
    deal_id: dealId,
    kind,
    body,
    meta,
    created_at: now,
    updated_at: now,
  };
  store.crm_events.push(row);
  const deal = store.crm_deals.find((entry) => entry.id === dealId);
  if (deal) {
    if (body.trim()) deal.notes = body;
    deal.updated_at = now;
  }
  return row;
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
  cloneDefaultCadenceEntries().forEach((entry, position) => {
    store.crm_stages.push({
      id: id(),
      pipeline_id: pipeline.id,
      nome: entry.nome,
      position,
      canonical_key: entry.key,
      created_at: created,
    });
  });
  return pipeline;
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
    return pipelinesOf(store, userId).map((row) => summarize(store, row));
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

  async reorderCrmPipelines(
    userId: string,
    pipelineIds: string[],
  ): Promise<boolean> {
    const store = getMockStore();
    const owned = pipelinesOf(store, userId);
    if (owned.length !== pipelineIds.length) return false;
    if (new Set(pipelineIds).size !== pipelineIds.length) return false;
    const known = new Set(owned.map((row) => row.id));
    if (pipelineIds.some((pipelineId) => !known.has(pipelineId))) return false;
    pipelineIds.forEach((pipelineId, position) => {
      const pipeline = store.crm_pipelines.find((row) => row.id === pipelineId);
      if (pipeline) pipeline.position = position;
    });
    return true;
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
    store.crm_events = store.crm_events.filter(
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
      canonical_key: null,
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
    const cnpj =
      input.cnpj == null || input.cnpj === ""
        ? null
        : String(input.cnpj).replace(/\D/g, "").padStart(14, "0");
    if (cnpj) {
      const existing = store.crm_deals.find(
        (row) => row.pipeline_id === pipeline.id && row.cnpj === cnpj,
      );
      if (existing) return toCard(store, existing);
    }
    const stage = pickCreateStage(stagesOf(store, pipeline.id), input.stage_id);
    if (!stage) return null;
    const position = store.crm_deals.filter(
      (row) => row.stage_id === stage.id,
    ).length;
    const created = nowIso();
    const secretaries = cleanList(input.secretaries);
    const people = peopleFromDeal({
      contact_name: input.contact_name?.trim() ?? "",
      secretaries,
      people: input.people,
    });
    const contactName =
      input.contact_name?.trim() || snapshotContactName(people);
    const deal: CrmDeal = {
      id: id(),
      pipeline_id: pipeline.id,
      stage_id: stage.id,
      company_name: input.company_name.trim(),
      contact_name: contactName,
      secretaries,
      people,
      phones: uniquePhones([
        ...cleanList(input.phones),
        ...people.map((person) => person.phone),
      ]).slice(0, 8),
      notes: input.notes?.trim() ?? "",
      cnpj,
      meta: input.meta ?? {},
      outcome: "open",
      amount_cents: null,
      position,
      created_at: created,
      updated_at: created,
    };
    store.crm_deals.push(deal);
    const notes = input.notes?.trim() ?? "";
    if (notes) insertEvent(store, deal.id, "nota", notes);
    return toCard(store, deal);
  },

  async findCrmDealByCnpj(
    userId: string,
    pipelineId: string,
    cnpj: string,
  ): Promise<CrmDealCard | null> {
    const store = getMockStore();
    if (!ownPipeline(store, userId, pipelineId)) return null;
    const digits = cnpj.replace(/\D/g, "").padStart(14, "0");
    const deal = store.crm_deals.find(
      (row) => row.pipeline_id === pipelineId && row.cnpj === digits,
    );
    return deal ? toCard(store, deal) : null;
  },

  async findCrmDealByCnpjForUser(
    userId: string,
    cnpj: string,
    preferredPipelineId?: string | null,
  ): Promise<CrmDealCard | null> {
    const store = getMockStore();
    const digits = cnpj.replace(/\D/g, "").padStart(14, "0");
    const matches = store.crm_deals.filter((row) => {
      if (row.cnpj !== digits) return false;
      return Boolean(ownPipeline(store, userId, row.pipeline_id));
    });
    if (matches.length === 0) return null;
    matches.sort((a, b) => {
      if (preferredPipelineId) {
        if (a.pipeline_id === preferredPipelineId) return -1;
        if (b.pipeline_id === preferredPipelineId) return 1;
      }
      return b.updated_at.localeCompare(a.updated_at);
    });
    return toCard(store, matches[0]!);
  },

  async hasCrmPipeline(userId: string): Promise<boolean> {
    return pipelinesOf(getMockStore(), userId).length > 0;
  },

  async listCrmDealCnpjs(userId: string, cnpjs: string[]): Promise<string[]> {
    const store = getMockStore();
    const wanted = new Set(
      cnpjs.map((value) => value.replace(/\D/g, "").padStart(14, "0")),
    );
    const found = new Set<string>();
    for (const deal of store.crm_deals) {
      if (!deal.cnpj || !wanted.has(deal.cnpj)) continue;
      if (!ownPipeline(store, userId, deal.pipeline_id)) continue;
      found.add(deal.cnpj);
    }
    return [...found];
  },

  async searchCrmDeals(
    userId: string,
    q: string,
    opts?: { preferredPipelineId?: string | null; limit?: number },
  ): Promise<CrmDealSearchHit[]> {
    if (!canSearchDeals(q)) return [];
    const store = getMockStore();
    const owned = pipelinesOf(store, userId);
    const pipelineById = new Map(owned.map((row) => [row.id, row]));
    const stageById = new Map(store.crm_stages.map((row) => [row.id, row]));
    const matches = store.crm_deals.filter((deal) => {
      if (!pipelineById.has(deal.pipeline_id)) return false;
      return dealMatchesSearch(deal, q);
    });
    const ranked = rankDealSearchHits(
      matches,
      q,
      opts?.preferredPipelineId,
    );
    const limit = clampDealSearchLimit(opts?.limit);
    return ranked.slice(0, limit).map((deal) => {
      const people = peopleFromDeal(deal);
      return toDealSearchHit({
        dealId: deal.id,
        pipelineId: deal.pipeline_id,
        pipelineNome: pipelineById.get(deal.pipeline_id)?.nome ?? "",
        stageNome: stageById.get(deal.stage_id)?.nome ?? "",
        company_name: deal.company_name,
        contact_name: deal.contact_name || people[0]?.name || "",
        outcome: deal.outcome,
      });
    });
  },

  async getCrmDeal(
    userId: string,
    dealId: string,
  ): Promise<CrmDealCard | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    return deal ? toCard(store, deal) : null;
  },

  async getCrmBriefingLookup(cnpj: string): Promise<CrmBriefingLookup | null> {
    const store = getMockStore();
    const padded = digitsCnpj(cnpj);
    const est = store.establishments.find(
      (row) => digitsCnpj(row.cnpj) === padded,
    );
    if (!est) return null;
    const municipioNome =
      store.ref_municipio.find((row) => row.id === est.municipio_id)?.nome ??
      null;
    const enrichment =
      store.lead_enrichment.find(
        (row) => digitsCnpj(row.cnpj) === padded && isEnrichmentVisible(row),
      ) ?? null;
    return {
      municipioNome,
      extraPhones: uniquePhones(
        [
          formatPhone(est.ddd1, est.telefone1),
          formatPhone(est.ddd2, est.telefone2),
        ].filter((value): value is string => Boolean(value)),
      ),
      presence: enrichment
        ? briefingPresenceFromFields({
            domainStatus: enrichment.domain_status,
            instagram: enrichment.socials?.instagram,
            whatsapp: enrichment.whatsapp,
            gmbMatched: enrichment.gmb?.matched,
          })
        : null,
    };
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
    if (patch.people !== undefined) {
      deal.people = sanitizePeople(patch.people);
      deal.contact_name = snapshotContactName(deal.people);
    } else if (patch.contact_name !== undefined) {
      deal.contact_name = patch.contact_name;
    }
    if (patch.secretaries !== undefined) {
      deal.secretaries = cleanList(patch.secretaries);
    }
    if (patch.phones !== undefined) deal.phones = cleanList(patch.phones);
    if (patch.notes !== undefined) deal.notes = patch.notes;
    if (patch.amount_cents !== undefined) deal.amount_cents = patch.amount_cents;
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
    store.crm_events = store.crm_events.filter((row) => row.deal_id !== dealId);
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

  async completeCrmActivity(
    userId: string,
    dealId: string,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent | null } | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    const open = openActivity(store, dealId);
    if (!open) return { deal: toCard(store, deal), event: null };
    closeOpenActivity(store, dealId);
    const event = insertEvent(store, dealId, open.kind, "");
    return { deal: toCard(store, deal), event };
  },

  async logCrmCall(
    userId: string,
    dealId: string,
    notes: string,
    next?: CrmNextAction | null,
    phone?: string,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
    return crmMockMethods.createCrmEvent(userId, dealId, {
      kind: "ligar",
      body: notes,
      next,
      meta: phone ? { phone } : {},
    });
  },

  async listCrmEvents(
    userId: string,
    dealId: string,
  ): Promise<CrmEvent[] | null> {
    const store = getMockStore();
    if (!ownDeal(store, userId, dealId)) return null;
    return store.crm_events
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.deal_id === dealId)
      .sort((a, b) => {
        const byTime = b.row.created_at.localeCompare(a.row.created_at);
        return byTime !== 0 ? byTime : b.index - a.index;
      })
      .map(({ row }) => row)
      .slice(0, CRM_EVENT_HISTORY_LIMIT);
  },

  async createCrmEvent(
    userId: string,
    dealId: string,
    input: CrmEventCreateInput,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    const event = insertEvent(
      store,
      dealId,
      input.kind,
      input.body?.trim() ?? "",
      input.meta ?? {},
    );
    if (input.next) insertActivity(store, dealId, input.next.kind, input.next.dueAt);
    return { deal: toCard(store, deal), event };
  },

  async updateCrmEvent(
    userId: string,
    dealId: string,
    eventId: string,
    body: string,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    const event = store.crm_events.find(
      (row) => row.id === eventId && row.deal_id === dealId,
    );
    if (!event) return null;
    event.body = body;
    event.updated_at = nowIso();
    if (body.trim()) deal.notes = body;
    deal.updated_at = event.updated_at;
    return { deal: toCard(store, deal), event };
  },

  async setCrmDealOutcome(
    userId: string,
    dealId: string,
    outcome: CrmOutcome,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    if (deal.outcome === outcome) {
      const existing = [...store.crm_events]
        .reverse()
        .find((row) => row.deal_id === dealId && row.kind === "outcome");
      const event =
        existing ?? insertEvent(store, dealId, "outcome", "", { outcome });
      return { deal: toCard(store, deal), event };
    }
    deal.outcome = outcome;
    const event = insertEvent(store, dealId, "outcome", "", { outcome });
    return { deal: toCard(store, deal), event };
  },

  async getCrmInboundEndpoint(
    userId: string,
  ): Promise<CrmInboundEndpoint | null> {
    return (
      getMockStore().crm_inbound_endpoints.find((row) => row.user_id === userId) ??
      null
    );
  },

  async getCrmInboundEndpointByTokenHash(
    tokenHash: string,
  ): Promise<CrmInboundEndpoint | null> {
    return (
      getMockStore().crm_inbound_endpoints.find(
        (row) => row.token_hash === tokenHash,
      ) ?? null
    );
  },

  async upsertCrmInboundEndpoint(
    userId: string,
    input: {
      pipelineId: string;
      stage_id?: string | null;
      token_hash: string;
    },
  ): Promise<CrmInboundEndpoint | null> {
    const store = getMockStore();
    if (!ownPipeline(store, userId, input.pipelineId)) return null;
    if (input.stage_id) {
      const stage = store.crm_stages.find(
        (row) =>
          row.id === input.stage_id && row.pipeline_id === input.pipelineId,
      );
      if (!stage) return null;
    }
    const now = nowIso();
    const existing = store.crm_inbound_endpoints.find(
      (row) => row.user_id === userId,
    );
    if (existing) {
      existing.pipeline_id = input.pipelineId;
      existing.stage_id = input.stage_id ?? null;
      existing.token_hash = input.token_hash;
      existing.updated_at = now;
      return existing;
    }
    const row: CrmInboundEndpoint = {
      id: id(),
      user_id: userId,
      pipeline_id: input.pipelineId,
      stage_id: input.stage_id ?? null,
      token_hash: input.token_hash,
      created_at: now,
      updated_at: now,
    };
    store.crm_inbound_endpoints.push(row);
    return row;
  },
};
