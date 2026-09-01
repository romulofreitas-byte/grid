import { afterEach, describe, expect, it } from "vitest";
import { mockRepo } from "./mock-repo";
import { getMockStore } from "./mock-store";

const USER = "qualify-account-user";

function cleanup() {
  const store = getMockStore();
  store.searches = store.searches.filter((s) => s.user_id !== USER);
  store.saved_leads = store.saved_leads.filter((l) => l.user_id !== USER);
  store.billed_cnpjs = store.billed_cnpjs.filter((row) => row.profile_id !== USER);
  store.enrichment_jobs = store.enrichment_jobs.filter(
    (j) => j.requested_by !== USER,
  );
}

describe("qualification belongs to the paying account", () => {
  afterEach(cleanup);

  it("does not skip charge when another account already has a global audit", async () => {
    const store = getMockStore();
    const fresh = store.lead_enrichment.find((e) => e.stage === "complete");
    expect(fresh).toBeTruthy();
    const out = await mockRepo.classifyEnrichmentCnpjs([fresh!.cnpj], USER);
    expect(out.chargeable).toContain(fresh!.cnpj);
  });

  it("skips CNPJs already billed to this account", async () => {
    const store = getMockStore();
    const fresh = store.lead_enrichment.find((e) => e.stage === "complete");
    expect(fresh).toBeTruthy();
    store.billed_cnpjs.push({
      profile_id: USER,
      cnpj: fresh!.cnpj,
      kind: "enrich",
    });
    const out = await mockRepo.classifyEnrichmentCnpjs([fresh!.cnpj], USER);
    expect(out.chargeable).not.toContain(fresh!.cnpj);
  });

  it("hides Qualificado on the grid until this account paid or finished a job", async () => {
    const store = getMockStore();
    const est = store.establishments[0]!;
    expect(store.lead_enrichment.some((e) => e.cnpj === est.cnpj)).toBe(true);
    const search = await mockRepo.createSavedCnpjSearch(USER, est.cnpj);
    expect(search?.saved).toBe(true);
    const { rows, unaudited } = await mockRepo.listGridRows(search!.id);
    expect(rows[0]?.hasAudit).toBe(false);
    expect(unaudited).toBe(1);
  });
});

describe("saved one-lead list", () => {
  afterEach(cleanup);

  it("creates an already-saved list of one CNPJ", async () => {
    const est = getMockStore().establishments[0]!;
    const search = await mockRepo.createSavedCnpjSearch(
      USER,
      est.cnpj,
      "Lista avulsa",
    );
    expect(search).toMatchObject({
      saved: true,
      nome: "Lista avulsa",
      total_found: 1,
    });
    expect(search?.filtros.cnpjs).toEqual([est.cnpj]);
    const { rows } = await mockRepo.listGridRows(search!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cnpj).toBe(est.cnpj);
  });

  it("removes a CNPJ from the saved list without deleting CRM deals", async () => {
    const store = getMockStore();
    const first = store.establishments[0]!;
    const second = store.establishments[1]!;
    const search = await mockRepo.createSavedCnpjSearch(USER, first.cnpj);
    store.saved_leads.push({
      id: "extra-lead",
      search_id: search!.id,
      user_id: USER,
      cnpj: second.cnpj,
      grid_score: 0,
      grid_position: 2,
      enrichment: null,
      status: "novo",
      notas: null,
      created_at: new Date().toISOString(),
    });
    search!.total_found = 2;

    expect(await mockRepo.deleteSavedLead(search!.id, first.cnpj)).toBe(true);
    const { rows, total } = await mockRepo.listGridRows(search!.id);
    expect(total).toBe(1);
    expect(rows[0]?.cnpj).toBe(second.cnpj);
    expect(rows[0]?.gridPosition).toBe(1);
  });
});
