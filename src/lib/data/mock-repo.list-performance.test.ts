import { afterEach, describe, expect, it } from "vitest";
import { mockRepo } from "./mock-repo";
import { getMockStore } from "./mock-store";

const USER = "listas-perf-user";

function cleanup() {
  const store = getMockStore();
  store.searches = store.searches.filter((s) => s.user_id !== USER);
  store.saved_leads = store.saved_leads.filter((l) => l.user_id !== USER);
  store.billed_cnpjs = store.billed_cnpjs.filter((row) => row.profile_id !== USER);
  store.call_events = store.call_events.filter((row) => row.user_id !== USER);
  const pipelineIds = new Set(
    store.crm_pipelines.filter((row) => row.user_id === USER).map((row) => row.id),
  );
  store.crm_deals = store.crm_deals.filter((row) => !pipelineIds.has(row.pipeline_id));
  store.crm_stages = store.crm_stages.filter(
    (row) => !pipelineIds.has(row.pipeline_id),
  );
  store.crm_pipelines = store.crm_pipelines.filter((row) => row.user_id !== USER);
}

describe("list search performance", () => {
  afterEach(cleanup);

  it("classifies wins outside em ação and filters the grid recorte", async () => {
    const store = getMockStore();
    const a = store.establishments[0]!.cnpj;
    const b = store.establishments[1]!.cnpj;
    const search = await mockRepo.createSavedCnpjList(USER, "Clínicas", [a, b]);
    expect(search).toBeTruthy();
    const leads = store.saved_leads.filter((lead) => lead.search_id === search!.id);
    const wonLead = leads.find((lead) => lead.cnpj === a)!;
    const idleLead = leads.find((lead) => lead.cnpj === b)!;
    wonLead.status = "reuniao";
    idleLead.status = "novo";
    store.billed_cnpjs.push({ profile_id: USER, cnpj: a, kind: "enrich" });
    await mockRepo.recordCallEvent(USER, {
      cnpj: a,
      savedLeadId: wonLead.id,
      source: "manual",
    });
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const entrada = board!.stages.find((stage) => stage.canonical_key === "entrada")!;
    store.crm_deals.push({
      id: "deal-win-1",
      pipeline_id: pipeline.id,
      stage_id: entrada.id,
      company_name: "Ganha",
      contact_name: "",
      secretaries: [],
      people: [],
      phones: [],
      notes: "",
      cnpj: a,
      meta: { searchId: search!.id },
      outcome: "won",
      amount_cents: null,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const [stats] = await mockRepo.listSearchPerformance(USER, [search!.id]);
    expect(stats).toMatchObject({
      total: 2,
      ganhos: 1,
      parados: 1,
      em_acao: 0,
      perdidos: 0,
      qualified: 1,
      called: 1,
    });

    const ganhos = await mockRepo.listGridRows(search!.id, 0, 50, "ganhos");
    expect(ganhos.listTotal).toBe(2);
    expect(ganhos.total).toBe(1);
    expect(ganhos.rows.map((row) => row.cnpj)).toEqual([a]);

    const parados = await mockRepo.listGridRows(search!.id, 0, 50, "parados");
    expect(parados.total).toBe(1);
    expect(parados.rows.map((row) => row.cnpj)).toEqual([b]);
  });
});
