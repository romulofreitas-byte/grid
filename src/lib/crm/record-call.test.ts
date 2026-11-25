import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, type SavedLead, type Search } from "@/lib/types";
import {
  countConfirmedCrmCall,
  reclassifyCrmCall,
  recordCompletedCall,
} from "./record-call";
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

  it("writes each attempt, including a second dial to the same CNPJ today", async () => {
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
    expect(second.counted).toBe(true);

    const stats = await mockRepo.getPilotStats(USER, { includeNext: false });
    expect(stats.hoje).toBe(2);
    const today = await mockRepo.listCallEventsToday(USER, [cnpj]);
    expect(today).toHaveLength(2);
    expect(store.call_events.every((row) => row.outcome === "discagem")).toBe(true);

    const lead = store.saved_leads.find((row) => row.id === "lead-call");
    expect(lead?.status).toBe("ligando");

    const deal = await mockRepo.findCrmDealByCnpjForUser(USER, cnpj);
    expect(deal).not.toBeNull();
    const events = await mockRepo.listCrmEvents(USER, deal!.id);
    const ligar = events?.filter((row) => row.kind === "ligar") ?? [];
    expect(ligar.length).toBeGreaterThanOrEqual(1);
    expect(ligar.every((row) => row.meta.call_outcome === "discagem")).toBe(true);
    expect(ligar.map((row) => row.meta.call_event_id).sort()).toEqual(
      store.call_events.map((row) => row.id).sort(),
    );

    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const stage = board?.stages.find((row) => row.id === deal!.stage_id);
    expect(stage?.canonical_key).toBe("tentando_contato");
  });

  it("counts a decision-maker conversation as a dial and moves the card forward", async () => {
    const store = getMockStore();
    const cnpj = store.establishments[0]!.cnpj;
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Padaria",
      cnpj,
    });

    await recordCompletedCall(mockRepo, {
      userId: USER,
      cnpj,
      source: "manual",
      outcome: "decisor",
      crmWrites: true,
    });

    const stats = await mockRepo.getPilotStats(USER, { includeNext: false });
    expect(stats.hoje).toBe(1);
    expect(store.call_events[0]?.outcome).toBe("decisor");
    const deal = await mockRepo.findCrmDealByCnpjForUser(USER, cnpj);
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const stage = board?.stages.find((row) => row.id === deal!.stage_id);
    expect(stage?.canonical_key).toBe("followup_decisor");
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

  it("keeps an open ligar on the Box card when VoIP only originates", async () => {
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

    const result = await recordCompletedCall(mockRepo, {
      userId: USER,
      cnpj,
      source: "dialer",
      crmWrites: true,
      completeOpenLigar: false,
      callId: "voip-call-1",
      phone: "31999990000",
    });
    expect(result.counted).toBe(true);

    const card = await mockRepo.getCrmDeal(USER, created!.id);
    expect(card?.next_activity?.kind).toBe("ligar");
    const events = await mockRepo.listCrmEvents(USER, created!.id);
    const ligar = events?.filter((row) => row.kind === "ligar") ?? [];
    expect(ligar).toHaveLength(1);
    expect(ligar[0]?.meta.call_outcome).toBe("discagem");
    expect(ligar[0]?.meta.call_event_id).toBe(store.call_events[0]?.id);
    expect(ligar[0]?.meta.call_id).toBe("voip-call-1");
    const stats = await mockRepo.getPilotStats(USER, { includeNext: false });
    expect(stats.hoje).toBe(1);

    await mockRepo.completeCrmActivity(USER, created!.id, card!.next_activity!.id);
    const after = await mockRepo.listCrmEvents(USER, created!.id);
    expect(after?.filter((row) => row.kind === "ligar")).toHaveLength(1);
    expect(store.call_events).toHaveLength(1);
  });

  it("switches the same call to decisor and back without a second dial", async () => {
    const store = getMockStore();
    const cnpj = store.establishments[0]!.cnpj;
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Padaria",
      cnpj,
    });

    await recordCompletedCall(mockRepo, {
      userId: USER,
      cnpj,
      source: "manual",
      crmWrites: true,
    });

    const deal = await mockRepo.findCrmDealByCnpjForUser(USER, cnpj);
    const events = await mockRepo.listCrmEvents(USER, deal!.id);
    const ligar = events?.find((row) => row.kind === "ligar");
    expect(ligar?.meta.call_outcome).toBe("discagem");

    const marked = await reclassifyCrmCall(mockRepo, {
      userId: USER,
      dealId: deal!.id,
      eventId: ligar!.id,
      outcome: "decisor",
    });
    expect(store.call_events).toHaveLength(1);
    expect(store.call_events[0]?.outcome).toBe("decisor");
    expect(marked?.event.meta.call_outcome).toBe("decisor");
    expect(marked?.event.meta.call_event_id).toBe(store.call_events[0]?.id);

    const forward = await mockRepo.getCrmBoard(USER, pipeline.id);
    const forwardStage = forward?.stages.find((row) => row.id === marked!.deal.stage_id);
    expect(forwardStage?.canonical_key).toBe("followup_decisor");

    const back = await reclassifyCrmCall(mockRepo, {
      userId: USER,
      dealId: deal!.id,
      eventId: ligar!.id,
      outcome: "discagem",
    });
    expect(store.call_events).toHaveLength(1);
    expect(store.call_events[0]?.outcome).toBe("discagem");
    expect(back?.event.meta.call_outcome).toBe("discagem");
    const stayed = await mockRepo.getCrmBoard(USER, pipeline.id);
    const stayedStage = stayed?.stages.find((row) => row.id === back!.deal.stage_id);
    expect(stayedStage?.canonical_key).toBe("followup_decisor");
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

    const ligarOpen = (await mockRepo.getCrmDeal(USER, ligarDeal!.id))!
      .next_activity!;
    const waOpen = (await mockRepo.getCrmDeal(USER, waDeal!.id))!.next_activity!;
    const doneLigar = await mockRepo.completeCrmActivity(
      USER,
      ligarDeal!.id,
      ligarOpen.id,
    );
    await countConfirmedCrmCall(mockRepo, USER, doneLigar!.deal, doneLigar!.event!.kind);

    const doneWa = await mockRepo.completeCrmActivity(
      USER,
      waDeal!.id,
      waOpen.id,
    );
    await countConfirmedCrmCall(mockRepo, USER, doneWa!.deal, doneWa!.event!.kind);

    const stats = await mockRepo.getPilotStats(USER, { includeNext: false });
    expect(stats.hoje).toBe(1);
    expect(store.call_events).toHaveLength(1);
    expect(store.call_events[0]?.source).toBe("crm");
    expect(doneLigar!.deal.next_activity).toBeNull();
    expect(doneWa!.deal.next_activity).toBeNull();
  });

  it("does not count scheduling or logging a ligar note without completing", async () => {
    const store = getMockStore();
    const cnpj = store.establishments[0]!.cnpj;
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const deal = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Agenda",
      cnpj,
    });
    const dueAt = new Date("2026-09-04T18:00:00.000Z").toISOString();
    await mockRepo.scheduleCrmActivity(USER, deal!.id, "ligar", dueAt);
    await mockRepo.logCrmCall(USER, deal!.id, "Liguei depois");

    const stats = await mockRepo.getPilotStats(USER, { includeNext: false });
    expect(stats.hoje).toBe(0);
    expect(store.call_events).toHaveLength(0);

    const card = await mockRepo.getCrmDeal(USER, deal!.id);
    expect(card?.next_activity?.kind).toBe("ligar");
    const events = await mockRepo.listCrmEvents(USER, deal!.id);
    expect(events?.some((row) => row.kind === "ligar")).toBe(true);
  });
});

describe("scheduleCrmActivity", () => {
  afterEach(cleanup);

  it("does not increment the ring when only the deadline is saved", async () => {
    const store = getMockStore();
    const cnpj = store.establishments[0]!.cnpj;
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const deal = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Agenda",
      cnpj,
    });
    const dueAt = new Date("2026-09-04T18:00:00.000Z").toISOString();
    await mockRepo.scheduleCrmActivity(USER, deal!.id, "ligar", dueAt);

    const stats = await mockRepo.getPilotStats(USER, { includeNext: false });
    expect(stats.hoje).toBe(0);
    expect(store.call_events).toHaveLength(0);
    const card = await mockRepo.getCrmDeal(USER, deal!.id);
    expect(card?.next_activity?.kind).toBe("ligar");
    const events = await mockRepo.listCrmEvents(USER, deal!.id);
    expect(events?.some((row) => row.kind === "ligar")).toBe(false);
  });
});
