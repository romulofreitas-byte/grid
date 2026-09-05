import { afterEach, describe, expect, it } from "vitest";
import { applyImportLeads, applyOneImportLead } from "./import-apply";
import { mockRepo } from "@/lib/data/mock-repo";
import { getMockStore } from "@/lib/data/mock-store";

const USER = "crm-import-user";

async function setupPipeline() {
  const pipeline = await mockRepo.createCrmPipeline(USER, "Inbound");
  const board = await mockRepo.getCrmBoard(USER, pipeline.id);
  return { pipeline, stageId: board!.stages[0]!.id };
}

describe("apply import leads", () => {
  afterEach(() => {
    const store = getMockStore();
    const ids = new Set(
      store.crm_pipelines.filter((row) => row.user_id === USER).map((row) => row.id),
    );
    store.crm_deals = store.crm_deals.filter((row) => !ids.has(row.pipeline_id));
    store.crm_stages = store.crm_stages.filter((row) => !ids.has(row.pipeline_id));
    store.crm_pipelines = store.crm_pipelines.filter((row) => row.user_id !== USER);
    store.crm_inbound_endpoints = store.crm_inbound_endpoints.filter(
      (row) => row.user_id !== USER,
    );
  });

  it("creates a company with CNPJ and a person without one", async () => {
    const { pipeline, stageId } = await setupPipeline();
    const result = await applyImportLeads({
      repo: mockRepo,
      userId: USER,
      pipelineId: pipeline.id,
      stageId,
      source: "import",
      rows: [
        { company: "Padaria", cnpj: "00000000000191", name: "João" },
        { name: "Maria", email: "maria@x.com", phone: "11981887766" },
        {},
      ],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([{ row: 3, message: "Linha vazia" }]);
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const maria = board?.deals.find((deal) => deal.contact_name === "Maria");
    expect(maria?.company_name).toBe("Maria");
    expect(maria?.people[0]?.email).toBe("maria@x.com");
    expect(maria?.meta.source).toBe("import");
    expect(board?.deals.find((deal) => deal.cnpj === "00000000000191")?.company_name).toBe(
      "Padaria",
    );
  });

  it("skips duplicates by CNPJ, email and phone", async () => {
    const { pipeline, stageId } = await setupPipeline();
    await applyImportLeads({
      repo: mockRepo,
      userId: USER,
      pipelineId: pipeline.id,
      stageId,
      source: "import",
      rows: [
        { company: "Padaria", cnpj: "00000000000191" },
        { name: "Maria", email: "maria@x.com", phone: "11981887766" },
      ],
    });
    const second = await applyImportLeads({
      repo: mockRepo,
      userId: USER,
      pipelineId: pipeline.id,
      stageId,
      source: "inbound",
      rows: [
        { company: "Padaria 2", cnpj: "00.000.000/0001-91" },
        { name: "Maria Silva", email: "MARIA@x.com" },
        { name: "Outra", phone: "(11) 98188-7766" },
      ],
    });
    expect("error" in second).toBe(false);
    if ("error" in second) return;
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(3);
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    expect(board?.deals).toHaveLength(2);
  });

  it("creates from a webhook-shaped payload", async () => {
    const { pipeline, stageId } = await setupPipeline();
    const result = await applyOneImportLead({
      repo: mockRepo,
      userId: USER,
      pipelineId: pipeline.id,
      stageId,
      source: "inbound",
      row: { company: "Oficina", name: "Pedro", phone: "11984561234" },
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.created).toBe(true);
    const deal = await mockRepo.getCrmDeal(USER, result.deal.id);
    expect(deal?.meta.source).toBe("inbound");
    expect(deal?.people[0]?.phone).toBeTruthy();
  });
});
