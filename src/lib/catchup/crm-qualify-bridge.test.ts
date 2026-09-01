import { afterEach, describe, expect, it, vi } from "vitest";
import { runUserCatchUp } from "@/lib/catchup/run";
import { onSearchSaved } from "@/lib/catchup/saved-list";
import { runCrmQualifyBridge } from "@/lib/catchup/tasks/crm-qualify-bridge";
import { mockRepo } from "@/lib/data/mock-repo";
import { getMockStore } from "@/lib/data/mock-store";
import { DEFAULT_FILTERS, type LeadEnrichment, type SavedLead, type Search } from "@/lib/types";

const crmAllowed = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@/lib/billing/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/service")>();
  return { ...actual, crmAllowed };
});

const USER = "catchup-crm-user";

function searchRow(id: string, saved: boolean): Search {
  return {
    id,
    user_id: USER,
    nome: "Lista · Clínicas",
    filtros: {
      ...DEFAULT_FILTERS,
      ufs: ["MG"],
    },
    total_found: 1,
    created_at: "2026-08-17T12:00:00.000Z",
    saved,
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

function auditFor(cnpj: string, expiresAt = "2026-09-15T12:00:00.000Z"): LeadEnrichment {
  const seed = getMockStore().lead_enrichment[0];
  if (!seed) throw new Error("seed enrichment missing");
  return { ...seed, cnpj, expires_at: expiresAt, stage: "complete" };
}

function cleanup() {
  const store = getMockStore();
  store.searches = store.searches.filter((row) => row.user_id !== USER);
  store.saved_leads = store.saved_leads.filter((row) => row.user_id !== USER);
  store.billed_cnpjs = store.billed_cnpjs.filter((row) => row.profile_id !== USER);
  store.user_catchup_state = store.user_catchup_state.filter(
    (row) => row.user_id !== USER,
  );
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
  const extra = store.establishments.slice(1).map((est) => est.cnpj);
  store.lead_enrichment = store.lead_enrichment.filter(
    (row) => !extra.includes(row.cnpj) || row.cnpj === store.establishments[0]?.cnpj,
  );
}

describe("crm qualify catch-up", () => {
  afterEach(() => {
    crmAllowed.mockResolvedValue(true);
    cleanup();
  });

  it("bridges a saved list with an old qualify and skips the second run", async () => {
    const store = getMockStore();
    const est = store.establishments[2];
    expect(est).toBeTruthy();
    const cnpj = est!.cnpj;
    store.searches.push(searchRow("saved-catchup", true));
    store.saved_leads.push(leadRow("lead-catchup", "saved-catchup", cnpj));
    store.billed_cnpjs.push({
      profile_id: USER,
      cnpj,
      kind: "enrich",
    });

    const first = await runUserCatchUp(USER, mockRepo);
    expect(first.created).toBe(1);
    expect(await mockRepo.listCrmDealCnpjs(USER, [cnpj])).toEqual([cnpj]);
    const deal = store.crm_deals.find((row) => row.cnpj === cnpj);
    expect(deal?.meta.source).toBe("catchup_bridge");

    store.user_catchup_state = store.user_catchup_state.filter(
      (row) => row.user_id !== USER,
    );
    const second = await runUserCatchUp(USER, mockRepo);
    expect(second.created).toBe(0);
    expect(store.crm_deals.filter((row) => row.cnpj === cnpj)).toHaveLength(1);
  });

  it("does not create deals for unsaved lists or unaudited CNPJs", async () => {
    const store = getMockStore();
    const est = store.establishments[2]!;
    const other = store.establishments[3]!;
    store.searches.push(
      searchRow("unsaved-catchup", false),
      { ...searchRow("saved-empty", true), id: "saved-empty" },
    );
    store.saved_leads.push(
      leadRow("lead-unsaved", "unsaved-catchup", est.cnpj),
      leadRow("lead-empty", "saved-empty", other.cnpj),
    );
    store.lead_enrichment.push(auditFor(est.cnpj));

    const out = await runUserCatchUp(USER, mockRepo);
    expect(out.created).toBe(0);
    expect(await mockRepo.listCrmDealCnpjs(USER, [est.cnpj, other.cnpj])).toEqual(
      [],
    );
  });

  it("still bridges expired complete audits and billed-only CNPJs", async () => {
    const store = getMockStore();
    const expiredEst = store.establishments[2]!;
    const billedEst = store.establishments[3]!;
    store.searches.push(searchRow("saved-expired", true));
    store.saved_leads.push(
      leadRow("lead-expired", "saved-expired", expiredEst.cnpj),
      leadRow("lead-billed", "saved-expired", billedEst.cnpj),
    );
    store.lead_enrichment.push(
      auditFor(expiredEst.cnpj, "2020-01-01T00:00:00.000Z"),
    );
    store.billed_cnpjs.push(
      {
        profile_id: USER,
        cnpj: expiredEst.cnpj,
        kind: "enrich",
      },
      {
        profile_id: USER,
        cnpj: billedEst.cnpj,
        kind: "enrich",
      },
    );

    const out = await runCrmQualifyBridge(mockRepo, USER);
    expect(out.created).toBe(2);
  });

  it("bridges already-qualified CNPJs when the list is saved later", async () => {
    const store = getMockStore();
    const est = store.establishments[2]!;
    store.searches.push(searchRow("save-later", false));
    store.saved_leads.push(leadRow("lead-save-later", "save-later", est.cnpj));
    store.billed_cnpjs.push({
      profile_id: USER,
      cnpj: est.cnpj,
      kind: "enrich",
    });

    expect(await runCrmQualifyBridge(mockRepo, USER)).toMatchObject({
      created: 0,
    });

    const saved = await mockRepo.saveSearch("save-later", { saved: true });
    expect(saved?.saved).toBe(true);
    await onSearchSaved(USER, saved!, mockRepo);
    expect(await mockRepo.listCrmDealCnpjs(USER, [est.cnpj])).toEqual([est.cnpj]);
  });

  it("does not create deals on Treino livre", async () => {
    crmAllowed.mockResolvedValue(false);
    const store = getMockStore();
    const est = store.establishments[2];
    expect(est).toBeTruthy();
    const cnpj = est!.cnpj;
    store.searches.push(searchRow("saved-free", true));
    store.saved_leads.push(leadRow("lead-free", "saved-free", cnpj));
    store.lead_enrichment.push(auditFor(cnpj));

    const out = await runCrmQualifyBridge(mockRepo, USER);
    expect(out).toEqual({ created: 0, skipped: 0, hasMore: false });
    expect(await mockRepo.listCrmDealCnpjs(USER, [cnpj])).toEqual([]);
  });
});
