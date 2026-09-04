import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, type SavedLead, type Search } from "@/lib/types";
import { recordCompletedCall, countConfirmedCrmCall } from "./record-call";
import { mockRepo } from "@/lib/data/mock-repo";
import { getMockStore } from "@/lib/data/mock-store";

const USER = "record-call-user";

function searchRow(id: string): Search {
  return {
    id,
    user_id: USER,
    nome: "Lista · Clínicas",
    filtros: { ...DEFAULT_FILTERS, ufs: ["MG"] },
    total_found: 1,
    created_at: "2026-08-17T12:00:00.000Z",
    saved: true,
  };
}

function leadRow(id: string, searchId: string, cnpj: string): SavedLead {
  return {
    id,
    search_id: searchId,
    user_id: USER,
    cnpj,
    grid_score: 10,
    grid_position: 1,
    enrichment: null,
    status: "novo",
    notas: null,
    created_at: "2026-08-17T12:00:00.000Z",
  };
}

function cleanup() {
  const store = getMockStore();
  store.searches = store.searches.filter((row) => row.user_id !== USER);
  store.saved_leads = store.saved_leads.filter((row) => row.user_id !== USER);
  store.call_events = store.call_events.filter((row) => row.user_id !== USER);
  const pipeIds = new Set(
    store.crm_pipelines.filter((row) => row.user_id === USER).map((row) => row.id),
  );
  store.crm_activities = store.crm_activities.filter((row) => {
    const deal = store.crm_deals.find((d) => d.id === row.deal_id);
    return !deal || !pipeIds.has(deal.pipeline_id);
  });
  store.crm_events = store.crm_events.filter((row) => {
    const deal = store.crm_deals.find((d) => d.id === row.deal_id);
    return !deal || !pipeIds.has(deal.pipeline_id);
  });
  store.crm_deals = store.crm_deals.filter((row) => !pipeIds.has(row.pipeline_id));
  store.crm_stages = store.crm_stages.filter((row) => !pipeIds.has(row.pipeline_id));
  store.crm_pipelines = store.crm_pipelines.filter((row) => row.user_id !== USER);
}

describe("recordCompletedCall", () => {
  afterEach(cleanup);

  it("writes call_events and Ligação feita, and does not double-count the same CNPJ today", async () => {
    const store = getMockStore();
    const cnpj = store.establishments[0]!.cnpj;
    store.searches.push(searchRow("search-call"));
    store.saved_leads.push(leadRow("lead-call", "search-call", cnpj));
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Padaria",
      cnpj,
    });

    const first = await recordCompletedCall(mockRepo, {
      userId: USER,
      cnpj,
      savedLeadId: "lead-call",
      source: "manual",
      crmWrites: true,
    });
    expect(first.counted).toBe(true);

    const second = await recordCompletedCall(mockRepo, {
      userId: USER,
      cnpj,
      savedLeadId: "lead-call",
      source: "manual",
      crmWrites: true,
    });
    expect(second.counted).toBe(false);

    const stats = await mockRepo.getPilotStats(USER, { includeNext: false });
    expect(stats.hoje).toBe(1);
    const today = await mockRepo.listCallEventsToday(USER, [cnpj]);
    expect(today).toHaveLength(1);

    const lead = store.saved_leads.find((row) => row.id === "lead-call");
    expect(lead?.status).toBe("ligando");

    const deal = await mockRepo.findCrmDealByCnpjForUser(USER, cnpj);
    expect(deal).not.toBeNull();
    const events = await mockRepo.listCrmEvents(USER, deal!.id);
    expect(events?.filter((row) => row.kind === "ligar").length).toBeGreaterThanOrEqual(1);

    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const stage = board?.stages.find((row) => row.id === deal!.stage_id);
    expect(stage?.canonical_key).toBe("tentando_contato");
  });

  it("does not count updateLead(status ligando) toward the ring", async () => {
    const store = getMockStore();
    const cnpj = store.establishments[0]!.cnpj;
    store.searches.push(searchRow("search-status"));
    store.saved_leads.push(leadRow("lead-status", "search-status", cnpj));

    await mockRepo.updateLead("lead-status", { status: "ligando" });
    const stats = await mockRepo.getPilotStats(USER, { includeNext: false });
    expect(stats.hoje).toBe(0);
    expect(store.saved_leads.find((row) => row.id === "lead-status")?.status).toBe(
      "ligando",
    );
  });

  it("closes an open ligar activity instead of duplicating the history item", async () => {
    const store = getMockStore();
    const cnpj = store.establishments[0]!.cnpj;
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Padaria",
      cnpj,
    });
    const dueAt = new Date("2026-09-02T15:00:00.000Z").toISOString();
    await mockRepo.scheduleCrmActivity(USER, created!.id, "ligar", dueAt);

    await recordCompletedCall(mockRepo, {
      userId: USER,
      cnpj,
      source: "manual",
      crmWrites: true,
    });

    const card = await mockRepo.getCrmDeal(USER, created!.id);
    expect(card?.next_activity).toBeNull();
    const events = await mockRepo.listCrmEvents(USER, created!.id);
    expect(events?.filter((row) => row.kind === "ligar")).toHaveLength(1);
  });
});

describe("countConfirmedCrmCall", () => {
  afterEach(cleanup);

  it("counts a completed ligar activity and ignores other kinds", async () => {
    const store = getMockStore();
    const cnpj = store.establishments[0]!.cnpj;
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const ligarDeal = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Ligar",
      cnpj,
    });
    const waCnpj = store.establishments[1]?.cnpj ?? `${cnpj.slice(0, 13)}1`;
    const waDeal = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "WhatsApp",
      cnpj: waCnpj,
    });
    const dueAt = new Date("2026-09-02T15:00:00.000Z").toISOString();
    await mockRepo.scheduleCrmActivity(USER, ligarDeal!.id, "ligar", dueAt);
    await mockRepo.scheduleCrmActivity(USER, waDeal!.id, "whatsapp", dueAt);

    const doneLigar = await mockRepo.completeCrmActivity(USER, ligarDeal!.id);
    await countConfirmedCrmCall(mockRepo, USER, doneLigar!.deal, doneLigar!.event!.kind);

    const doneWa = await mockRepo.completeCrmActivity(USER, waDeal!.id);
    await countConfirmedCrmCall(mockRepo, USER, doneWa!.deal, doneWa!.event!.kind);

    const stats = await mockRepo.getPilotStats(USER, { includeNext: false });
    expect(stats.hoje).toBe(1);
    expect(store.call_events).toHaveLength(1);
    expect(store.call_events[0]?.source).toBe("crm");
  });
});
