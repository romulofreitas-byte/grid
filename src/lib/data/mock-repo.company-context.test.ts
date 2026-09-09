import { afterEach, describe, expect, it } from "vitest";
import { mockRepo } from "@/lib/data/mock-repo";
import { getMockStore } from "@/lib/data/mock-store";
import { DEFAULT_FILTERS, type SavedLead, type Search } from "@/lib/types";

const USER = "empresas-context-user";
const CNPJ = "12345678000190";

function cleanup() {
  const store = getMockStore();
  store.searches = store.searches.filter((row) => row.user_id !== USER);
  store.saved_leads = store.saved_leads.filter((row) => row.user_id !== USER);
  const pipeIds = new Set(
    store.crm_pipelines.filter((row) => row.user_id === USER).map((row) => row.id),
  );
  store.crm_activities = store.crm_activities.filter((row) => {
    const deal = store.crm_deals.find((d) => d.id === row.deal_id);
    return !deal || !pipeIds.has(deal.pipeline_id);
  });
  store.crm_deals = store.crm_deals.filter((row) => !pipeIds.has(row.pipeline_id));
  store.crm_stages = store.crm_stages.filter((row) => !pipeIds.has(row.pipeline_id));
  store.crm_pipelines = store.crm_pipelines.filter((row) => row.user_id !== USER);
}

describe("listCompanyGridContext", () => {
  afterEach(cleanup);

  it("returns empty placement for unknown CNPJs", async () => {
    const rows = await mockRepo.listCompanyGridContext(USER, [CNPJ]);
    expect(rows).toEqual([
      { cnpj: CNPJ, called: false, crm: null, list: null },
    ]);
  });

  it("prefers a saved list and marks called from any lead", async () => {
    const store = getMockStore();
    const draft: Search = {
      id: "draft-s",
      user_id: USER,
      nome: "Rascunho",
      filtros: { ...DEFAULT_FILTERS },
      total_found: 1,
      created_at: "2026-08-01T12:00:00.000Z",
      saved: false,
    };
    const saved: Search = {
      id: "saved-s",
      user_id: USER,
      nome: "Clínicas BH",
      filtros: { ...DEFAULT_FILTERS },
      total_found: 1,
      created_at: "2026-08-02T12:00:00.000Z",
      saved: true,
    };
    store.searches.unshift(draft, saved);
    const draftLead: SavedLead = {
      id: "lead-draft",
      search_id: draft.id,
      user_id: USER,
      cnpj: CNPJ,
      grid_score: 1,
      grid_position: 1,
      enrichment: null,
      status: "ligando",
      notas: null,
      created_at: "2026-08-03T12:00:00.000Z",
    };
    const savedLead: SavedLead = {
      ...draftLead,
      id: "lead-saved",
      search_id: saved.id,
      status: "novo",
      created_at: "2026-08-02T12:00:00.000Z",
    };
    store.saved_leads.push(draftLead, savedLead);
    const rows = await mockRepo.listCompanyGridContext(USER, [CNPJ]);
    expect(rows[0]?.called).toBe(true);
    expect(rows[0]?.list).toEqual({
      searchId: "saved-s",
      nome: "Clínicas BH",
      saved: true,
    });
  });

  it("attaches the latest CRM deal", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const deal = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "ACME",
      cnpj: CNPJ,
    });
    expect(deal).toBeTruthy();
    const rows = await mockRepo.listCompanyGridContext(USER, [CNPJ]);
    expect(rows[0]?.crm).toMatchObject({
      dealId: deal!.id,
      pipelineId: pipeline.id,
      pipelineNome: "Clínicas",
    });
  });
});
