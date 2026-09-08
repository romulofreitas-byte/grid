import { earliestOpenActivity, sortOpenActivities } from "@/lib/crm/activity";
import { digitsCnpj } from "@/lib/crm/bridge";
import { cloneDefaultCadenceEntries, pickCreateStage } from "@/lib/crm/cadence";
import {
  briefingAssetsFromFields,
  briefingPresenceFromFields,
  formatReceitaAddress,
  mergeSourcedPhones,
  sourcedPhonesFromEvidence,
  type CrmBriefingLookup,
} from "@/lib/crm/briefing";
import { searchHitsFromDeals } from "@/lib/crm/deal-search";
import { uniquePhones } from "@/lib/crm/dial";
import {
  mapTransferStageId,
  mergeDealNotes,
  mergeDealPhones,
  pickMergeSurvivor,
  pickOpenActivityKeepId,
  type CrmDealTransferResult,
} from "@/lib/crm/transfer";
import { shouldRemoveEntradaDeal } from "@/lib/crm/pipeline-removal";
import { CRM_EVENT_HISTORY_LIMIT } from "@/lib/crm/events";
import {
  INBOUND_EVENT_KEEP,
  INBOUND_EVENT_LIST_LIMIT,
} from "@/lib/crm/inbound-events";
import {
  IMPORT_ISSUE_CAP,
  IMPORT_RUN_KEEP,
  IMPORT_RUN_LIST_LIMIT,
  ignoreImportRunErrors,
} from "@/lib/crm/import-history";
import { peopleFromDeal, sanitizePeople, sanitizeSecretaries, snapshotContactName, socioNamesForBriefing } from "@/lib/crm/people";
import { resolveDecisor } from "@/lib/decisor";
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
  CrmFormChannel,
  CrmInboundEndpoint,
  CrmInboundEndpointCreateInput,
  CrmInboundEndpointPatchInput,
  CrmInboundEvent,
  CrmInboundEventCreateInput,
  CrmImportRun,
  CrmImportRunCreateInput,
  CrmLeadKind,
  CrmMetaConnection,
  CrmMetaConnectionRecord,
  CrmNextAction,
  CrmImportRun,
  CrmImportRunCreateInput,
  CrmLeadKind,
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

function openActivities(store: MockStore, dealId: string): CrmActivity[] {
  return sortOpenActivities(
    store.crm_activities.filter(
      (row) => row.deal_id === dealId && row.status === "open",
    ),
  );
}

function toCard(store: MockStore, deal: CrmDeal): CrmDealCard {
  if (!deal.people) {
    deal.people = peopleFromDeal(deal);
  }
  const open_activities = openActivities(store, deal.id);
  return {
    ...deal,
    open_activities,
    next_activity: earliestOpenActivity(open_activities),
  };
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

function insertActivity(
  store: MockStore,
  dealId: string,
  kind: CrmActivityKind,
  dueAt: string,
): CrmActivity {
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

function listEntradaDealsForSearch(
  store: MockStore,
  userId: string,
  searchId: string,
) {
  const owned = new Set(pipelinesOf(store, userId).map((row) => row.id));
  return store.crm_deals.filter((deal) => {
    if (!owned.has(deal.pipeline_id)) return false;
    const stage = store.crm_stages.find((row) => row.id === deal.stage_id);
    return shouldRemoveEntradaDeal({
      listSearchId: searchId,
      searchId: deal.meta.searchId,
      source: deal.meta.source,
      outcome: deal.outcome,
      canonicalKey: stage?.canonical_key ?? null,
    });
  });
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

  async listCrmStages(
    userId: string,
    pipelineId: string,
  ): Promise<CrmStage[] | null> {
    const store = getMockStore();
    const pipeline = ownPipeline(store, userId, pipelineId);
    if (!pipeline) return null;
    return stagesOf(store, pipelineId);
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
    const secretaries = sanitizeSecretaries(input.secretaries);
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

  async createCrmDeals(
    userId: string,
    inputs: CrmDealCreateInput[],
  ): Promise<(CrmDealCard | null)[]> {
    const cards: Array<CrmDealCard | null> = [];
    for (const input of inputs) {
      cards.push(await crmMockMethods.createCrmDeal(userId, input));
    }
    return cards;
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
    const store = getMockStore();
    const owned = pipelinesOf(store, userId);
    const pipelineById = new Map(owned.map((row) => [row.id, row]));
    const stageById = new Map(store.crm_stages.map((row) => [row.id, row]));
    return searchHitsFromDeals(
      store.crm_deals.filter((deal) => pipelineById.has(deal.pipeline_id)),
      q,
      {
        preferredPipelineId: opts?.preferredPipelineId,
        limit: opts?.limit,
        pipelineNome: (id) => pipelineById.get(id)?.nome ?? "",
        stageNome: (id) => stageById.get(id)?.nome ?? "",
      },
    );
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
    const company = store.companies.find(
      (row) => row.cnpj_basico === est.cnpj_basico,
    );
    const partners = store.partners.filter(
      (row) => row.cnpj_basico === est.cnpj_basico,
    );
    const decisor = resolveDecisor(partners, store.ref_qualificacao, {
      razaoSocial: company?.razao_social ?? "",
      naturezaId: company?.natureza_id ?? null,
    });
    const extraPhones = uniquePhones(
      [
        formatPhone(est.ddd1, est.telefone1),
        formatPhone(est.ddd2, est.telefone2),
      ].filter((value): value is string => Boolean(value)),
    );
    return {
      municipioNome,
      extraPhones,
      sourcedPhones: mergeSourcedPhones([
        ...(enrichment ? sourcedPhonesFromEvidence(enrichment.phones) : []),
        ...extraPhones.map((phone) => ({ phone, source: "receita" as const })),
      ]),
      presence: enrichment
        ? briefingPresenceFromFields({
            domainStatus: enrichment.domain_status,
            instagram: enrichment.socials?.instagram,
            whatsapp: enrichment.whatsapp,
            gmbMatched: enrichment.gmb?.matched,
          })
        : null,
      address: formatReceitaAddress({
        logradouro: est.logradouro,
        numero: est.numero,
        bairro: est.bairro,
        municipio: municipioNome,
        uf: est.uf,
      }),
      cnae:
        store.ref_cnae.find((row) => row.codigo === est.cnae_principal)
          ?.descricao ?? null,
      decisor: decisor?.nome ?? null,
      socios: socioNamesForBriefing(partners, decisor?.nome ?? null),
      assets: enrichment
        ? briefingAssetsFromFields({
            domain: enrichment.domain,
            domainStatus: enrichment.domain_status,
            instagram: enrichment.socials?.instagram,
            whatsapp: enrichment.whatsapp,
            gmb: enrichment.gmb,
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
      deal.secretaries = sanitizeSecretaries(patch.secretaries);
    }
    if (patch.phones !== undefined) deal.phones = cleanList(patch.phones);
    if (patch.notes !== undefined) deal.notes = patch.notes;
    if (patch.amount_cents !== undefined) deal.amount_cents = patch.amount_cents;
    if (patch.cnpj !== undefined) deal.cnpj = patch.cnpj;
    if (patch.meta !== undefined) deal.meta = { ...deal.meta, ...patch.meta };
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

  async transferCrmDeal(
    userId: string,
    dealId: string,
    toPipelineId: string,
  ): Promise<CrmDealTransferResult | null> {
    const store = getMockStore();
    const source = ownDeal(store, userId, dealId);
    if (!source) return null;
    const fromPipelineId = source.pipeline_id;
    if (fromPipelineId === toPipelineId) {
      return {
        deal: toCard(store, source),
        fromPipelineId,
        fromDealId: source.id,
        merged: false,
      };
    }
    if (!ownPipeline(store, userId, toPipelineId)) return null;
    const destStages = stagesOf(store, toPipelineId);
    const sourceStage = store.crm_stages.find((row) => row.id === source.stage_id);
    const mappedStageId = mapTransferStageId(sourceStage, destStages);
    if (!mappedStageId) return null;

    const collision =
      source.cnpj == null
        ? undefined
        : store.crm_deals.find(
            (row) =>
              row.pipeline_id === toPipelineId &&
              row.cnpj === source.cnpj &&
              row.id !== source.id,
          );

    if (collision) {
      const destStage = store.crm_stages.find(
        (row) => row.id === collision.stage_id,
      );
      const survivor = pickMergeSurvivor(
        source,
        collision,
        sourceStage,
        destStage,
      );
      const other = survivor.id === source.id ? collision : source;
      survivor.notes = mergeDealNotes(survivor.notes, other.notes);
      survivor.phones = mergeDealPhones(survivor.phones, other.phones);
      if (survivor.amount_cents == null) survivor.amount_cents = other.amount_cents;
      const acts = store.crm_activities.filter(
        (row) => row.deal_id === survivor.id || row.deal_id === other.id,
      );
      const keepId = pickOpenActivityKeepId(acts);
      for (const act of acts) {
        if (act.status === "open" && act.id !== keepId) act.status = "done";
      }
      for (const act of store.crm_activities) {
        if (act.deal_id === other.id) act.deal_id = survivor.id;
      }
      for (const event of store.crm_events) {
        if (event.deal_id === other.id) event.deal_id = survivor.id;
      }
      for (const event of store.crm_inbound_events) {
        if (event.deal_id === other.id) event.deal_id = survivor.id;
      }
      const otherStageId = other.stage_id;
      store.crm_deals = store.crm_deals.filter((row) => row.id !== other.id);
      compactStage(store, otherStageId);
      if (survivor.id === source.id) {
        survivor.pipeline_id = toPipelineId;
        moveDealInStore(store, survivor, mappedStageId, 0);
      }
      survivor.updated_at = nowIso();
      return {
        deal: toCard(store, survivor),
        fromPipelineId,
        fromDealId: source.id,
        merged: true,
      };
    }

    source.pipeline_id = toPipelineId;
    moveDealInStore(store, source, mappedStageId, 0);
    source.updated_at = nowIso();
    return {
      deal: toCard(store, source),
      fromPipelineId,
      fromDealId: source.id,
      merged: false,
    };
  },

  async countCrmEntradaDealsForSearch(
    userId: string,
    searchId: string,
  ): Promise<number> {
    return listEntradaDealsForSearch(getMockStore(), userId, searchId).length;
  },

  async deleteCrmEntradaDealsForSearch(
    userId: string,
    searchId: string,
  ): Promise<number> {
    const store = getMockStore();
    const deals = listEntradaDealsForSearch(store, userId, searchId);
    for (const deal of deals) {
      store.crm_activities = store.crm_activities.filter(
        (row) => row.deal_id !== deal.id,
      );
      store.crm_events = store.crm_events.filter(
        (row) => row.deal_id !== deal.id,
      );
      store.crm_deals = store.crm_deals.filter((row) => row.id !== deal.id);
      compactStage(store, deal.stage_id);
    }
    return deals.length;
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

  async rescheduleCrmActivity(
    userId: string,
    dealId: string,
    activityId: string,
    kind: CrmActivityKind,
    dueAt: string,
  ): Promise<CrmDealCard | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    const activity = store.crm_activities.find(
      (row) =>
        row.id === activityId &&
        row.deal_id === dealId &&
        row.status === "open",
    );
    if (!activity) return null;
    activity.kind = kind;
    activity.due_at = dueAt;
    deal.updated_at = nowIso();
    return toCard(store, deal);
  },

  async completeCrmActivity(
    userId: string,
    dealId: string,
    activityId: string,
  ): Promise<{ deal: CrmDealCard; event: CrmEvent | null } | null> {
    const store = getMockStore();
    const deal = ownDeal(store, userId, dealId);
    if (!deal) return null;
    const open = store.crm_activities.find(
      (row) =>
        row.id === activityId &&
        row.deal_id === dealId &&
        row.status === "open",
    );
    if (!open) return { deal: toCard(store, deal), event: null };
    open.status = "done";
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

  async listCrmInboundEndpoints(
    userId: string,
  ): Promise<CrmInboundEndpoint[]> {
    return getMockStore()
      .crm_inbound_endpoints.filter((row) => row.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async getCrmInboundEndpointById(
    userId: string,
    endpointId: string,
  ): Promise<CrmInboundEndpoint | null> {
    return (
      getMockStore().crm_inbound_endpoints.find(
        (row) => row.id === endpointId && row.user_id === userId,
      ) ?? null
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

  async getCrmInboundEndpointByPublicTokenHash(
    tokenHash: string,
  ): Promise<CrmInboundEndpoint | null> {
    return (
      getMockStore().crm_inbound_endpoints.find(
        (row) => row.public_token_hash === tokenHash,
      ) ?? null
    );
  },

  async findCrmInboundEndpoint(
    endpointId: string,
  ): Promise<CrmInboundEndpoint | null> {
    return (
      getMockStore().crm_inbound_endpoints.find((row) => row.id === endpointId) ??
      null
    );
  },

  async findCrmInboundEndpointsForMetaLead(
    pageId: string,
    formId: string | null,
  ): Promise<CrmInboundEndpoint[]> {
    const store = getMockStore();
    const connections = store.crm_meta_connections.filter(
      (row) => row.page_id === pageId && row.status === "active",
    );
    const ids = new Set(connections.map((row) => row.id));
    const mapped = store.crm_inbound_endpoints.filter(
      (row) =>
        row.channel === "meta" &&
        row.meta_connection_id &&
        ids.has(row.meta_connection_id) &&
        (!row.meta_form_id || (formId != null && row.meta_form_id === formId)),
    );
    if (!formId) return mapped;
    const exact = mapped.filter((row) => row.meta_form_id === formId);
    return exact.length > 0 ? exact : mapped.filter((row) => !row.meta_form_id);
  },

  async createCrmInboundEndpoint(
    userId: string,
    input: CrmInboundEndpointCreateInput,
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
    const row: CrmInboundEndpoint = {
      id: id(),
      user_id: userId,
      pipeline_id: input.pipelineId,
      stage_id: input.stage_id ?? null,
      nome: input.nome.trim(),
      lead_kind: input.lead_kind,
      channel: input.channel,
      token_hash: input.token_hash,
      public_token_hash: input.public_token_hash ?? null,
      form_fields: input.form_fields ?? {},
      meta_connection_id: input.meta_connection_id ?? null,
      meta_form_id: input.meta_form_id ?? null,
      created_at: now,
      updated_at: now,
    };
    store.crm_inbound_endpoints.push(row);
    return row;
  },

  async updateCrmInboundEndpoint(
    userId: string,
    endpointId: string,
    input: CrmInboundEndpointPatchInput,
  ): Promise<CrmInboundEndpoint | null> {
    const store = getMockStore();
    const existing = store.crm_inbound_endpoints.find(
      (row) => row.id === endpointId && row.user_id === userId,
    );
    if (!existing) return null;
    const pipelineId = input.pipelineId ?? existing.pipeline_id;
    if (!ownPipeline(store, userId, pipelineId)) return null;
    const stageId =
      input.stage_id !== undefined ? input.stage_id : existing.stage_id;
    if (stageId) {
      const stage = store.crm_stages.find(
        (row) => row.id === stageId && row.pipeline_id === pipelineId,
      );
      if (!stage) return null;
    }
    if (input.nome !== undefined) existing.nome = input.nome.trim();
    if (input.lead_kind !== undefined) existing.lead_kind = input.lead_kind;
    if (input.channel !== undefined) existing.channel = input.channel;
    if (input.token_hash !== undefined) existing.token_hash = input.token_hash;
    if (input.public_token_hash !== undefined) {
      existing.public_token_hash = input.public_token_hash;
    }
    if (input.form_fields !== undefined) existing.form_fields = input.form_fields;
    if (input.meta_connection_id !== undefined) {
      existing.meta_connection_id = input.meta_connection_id;
    }
    if (input.meta_form_id !== undefined) existing.meta_form_id = input.meta_form_id;
    existing.pipeline_id = pipelineId;
    existing.stage_id = stageId;
    existing.updated_at = nowIso();
    return existing;
  },

  async deleteCrmInboundEndpoint(
    userId: string,
    endpointId: string,
  ): Promise<boolean> {
    const store = getMockStore();
    const before = store.crm_inbound_endpoints.length;
    store.crm_inbound_endpoints = store.crm_inbound_endpoints.filter(
      (row) => !(row.id === endpointId && row.user_id === userId),
    );
    return store.crm_inbound_endpoints.length < before;
  },

  async createCrmInboundEvent(
    userId: string,
    input: CrmInboundEventCreateInput,
  ): Promise<CrmInboundEvent | null> {
    const store = getMockStore();
    const endpoint = store.crm_inbound_endpoints.find(
      (row) => row.id === input.endpointId && row.user_id === userId,
    );
    if (!endpoint) return null;
    const row: CrmInboundEvent = {
      id: id(),
      endpoint_id: input.endpointId,
      user_id: userId,
      status: input.status,
      http_status: input.httpStatus,
      message: input.message.slice(0, 200),
      deal_id: input.dealId ?? null,
      snapshot: input.snapshot,
      payload: input.payload ?? null,
      external_id: input.externalId ?? null,
      created_at: nowIso(),
    };
    store.crm_inbound_events.push(row);
    const kept = store.crm_inbound_events
      .filter((item) => item.endpoint_id === input.endpointId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, INBOUND_EVENT_KEEP)
      .map((item) => item.id);
    const keep = new Set(kept);
    store.crm_inbound_events = store.crm_inbound_events.filter(
      (item) => item.endpoint_id !== input.endpointId || keep.has(item.id),
    );
    return row;
  },

  async findCrmInboundEventByExternalId(
    endpointId: string,
    externalId: string,
  ): Promise<CrmInboundEvent | null> {
    return (
      getMockStore().crm_inbound_events.find(
        (row) =>
          row.endpoint_id === endpointId && row.external_id === externalId,
      ) ?? null
    );
  },

  async listCrmInboundEvents(
    userId: string,
    endpointId: string,
    limit = INBOUND_EVENT_LIST_LIMIT,
  ): Promise<CrmInboundEvent[]> {
    const cap = Math.min(Math.max(limit, 1), INBOUND_EVENT_LIST_LIMIT);
    return getMockStore()
      .crm_inbound_events.filter(
        (row) => row.user_id === userId && row.endpoint_id === endpointId,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, cap);
  },

  async listCrmInboundLastEvents(userId: string): Promise<CrmInboundEvent[]> {
    const byEndpoint = new Map<string, CrmInboundEvent>();
    for (const row of getMockStore().crm_inbound_events) {
      if (row.user_id !== userId) continue;
      const current = byEndpoint.get(row.endpoint_id);
      if (!current || row.created_at > current.created_at) {
        byEndpoint.set(row.endpoint_id, row);
      }
    }
    return [...byEndpoint.values()];
  },

  async listCrmMetaConnections(userId: string): Promise<CrmMetaConnection[]> {
    return getMockStore()
      .crm_meta_connections.filter(
        (row) => row.user_id === userId && row.status === "active",
      )
      .map((row) => ({
        id: row.id,
        user_id: row.user_id,
        page_id: row.page_id,
        page_name: row.page_name,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
  },

  async getCrmMetaConnection(
    userId: string,
    connectionId: string,
  ): Promise<CrmMetaConnectionRecord | null> {
    return (
      getMockStore().crm_meta_connections.find(
        (row) => row.id === connectionId && row.user_id === userId,
      ) ?? null
    );
  },

  async getCrmMetaConnectionByPageId(
    pageId: string,
  ): Promise<CrmMetaConnectionRecord | null> {
    return (
      getMockStore().crm_meta_connections.find(
        (row) => row.page_id === pageId && row.status === "active",
      ) ?? null
    );
  },

  async upsertCrmMetaConnection(
    userId: string,
    input: {
      pageId: string;
      pageName: string;
      credentialsCiphertext: string;
      credentialsNonce: string;
    },
  ): Promise<CrmMetaConnectionRecord | null> {
    const store = getMockStore();
    const existing = store.crm_meta_connections.find(
      (row) => row.user_id === userId && row.page_id === input.pageId,
    );
    const now = nowIso();
    if (existing) {
      existing.page_name = input.pageName;
      existing.status = "active";
      existing.credentials_ciphertext = input.credentialsCiphertext;
      existing.credentials_nonce = input.credentialsNonce;
      existing.updated_at = now;
      return existing;
    }
    const row: CrmMetaConnectionRecord = {
      id: id(),
      user_id: userId,
      page_id: input.pageId,
      page_name: input.pageName,
      status: "active",
      credentials_ciphertext: input.credentialsCiphertext,
      credentials_nonce: input.credentialsNonce,
      created_at: now,
      updated_at: now,
    };
    store.crm_meta_connections.push(row);
    return row;
  },

  async createCrmImportRun(
    userId: string,
    input: CrmImportRunCreateInput,
  ): Promise<CrmImportRun | null> {
    const store = getMockStore();
    const row: CrmImportRun = {
      id: id(),
      user_id: userId,
      pipeline_id: input.pipelineId,
      pipeline_nome: input.pipelineNome.slice(0, 80),
      file_name: input.fileName?.trim().slice(0, 200) || null,
      created: input.created,
      skipped: input.skipped,
      error_count: input.errorCount,
      matched_cnpjs: input.matchedCnpjs,
      list_id: input.listId ?? null,
      qualified: input.qualified,
      issues: input.issues.slice(0, IMPORT_ISSUE_CAP),
      created_at: nowIso(),
    };
    store.crm_import_runs.push(row);
    const kept = store.crm_import_runs
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, IMPORT_RUN_KEEP)
      .map((item) => item.id);
    const keep = new Set(kept);
    store.crm_import_runs = store.crm_import_runs.filter(
      (item) => item.user_id !== userId || keep.has(item.id),
    );
    return row;
  },

  async listCrmImportRuns(
    userId: string,
    limit = IMPORT_RUN_LIST_LIMIT,
  ): Promise<CrmImportRun[]> {
    const cap = Math.min(Math.max(limit, 1), IMPORT_RUN_LIST_LIMIT);
    return getMockStore()
      .crm_import_runs.filter((row) => row.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, cap)
      .map((row) => ({ ...row, issues: [] }));
  },

  async getCrmImportRun(
    userId: string,
    runId: string,
  ): Promise<CrmImportRun | null> {
    const row = getMockStore().crm_import_runs.find(
      (item) => item.id === runId && item.user_id === userId,
    );
    return row ? { ...row, issues: [...row.issues] } : null;
  },

  async ignoreCrmImportRunErrors(
    userId: string,
    runId: string,
  ): Promise<CrmImportRun | null> {
    const store = getMockStore();
    const index = store.crm_import_runs.findIndex(
      (item) => item.id === runId && item.user_id === userId,
    );
    if (index < 0) return null;
    const next = ignoreImportRunErrors(store.crm_import_runs[index]!);
    store.crm_import_runs[index] = next;
    return { ...next, issues: [...next.issues] };
  },
};
