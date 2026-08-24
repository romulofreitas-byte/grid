import { afterEach, describe, expect, it } from "vitest";
import { activitySignal } from "@/lib/crm/activity";
import { mockRepo } from "@/lib/data/mock-repo";
import { getMockStore } from "@/lib/data/mock-store";

const USER = "crm-board-user";

describe("crm mock board", () => {
  afterEach(() => {
    const store = getMockStore();
    const ids = new Set(
      store.crm_pipelines.filter((row) => row.user_id === USER).map((row) => row.id),
    );
    store.crm_activities = store.crm_activities.filter((row) => {
      const deal = store.crm_deals.find((d) => d.id === row.deal_id);
      return !deal || !ids.has(deal.pipeline_id);
    });
    store.crm_deals = store.crm_deals.filter((row) => !ids.has(row.pipeline_id));
    store.crm_stages = store.crm_stages.filter((row) => !ids.has(row.pipeline_id));
    store.crm_pipelines = store.crm_pipelines.filter((row) => row.user_id !== USER);
  });

  it("seeds a default cadence for a new piloto", async () => {
    const pipelines = await mockRepo.listCrmPipelines(USER);
    expect(pipelines).toHaveLength(1);
    const board = await mockRepo.getCrmBoard(USER, pipelines[0]!.id);
    expect(board?.stages.map((stage) => stage.nome)[0]).toBe("Entrada de Lista");
    expect(board?.stages).toHaveLength(10);
  });

  it("moves negócios to another faixa before deleting it", async () => {
    const pipelines = await mockRepo.listCrmPipelines(USER);
    const pipelineId = pipelines[0]!.id;
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId,
      company_name: "Oficina Teste",
    });
    expect(created).toBeTruthy();
    const board = await mockRepo.getCrmBoard(USER, pipelineId);
    const from = board!.stages[0]!;
    const to = board!.stages[1]!;
    expect(board!.deals.some((deal) => deal.stage_id === from.id)).toBe(true);

    const ok = await mockRepo.deleteCrmStage(USER, from.id, to.id);
    expect(ok).toBe(true);
    const next = await mockRepo.getCrmBoard(USER, pipelineId);
    expect(next?.stages.some((stage) => stage.id === from.id)).toBe(false);
    expect(next?.deals.every((deal) => deal.stage_id !== from.id)).toBe(true);
    expect(next?.deals.some((deal) => deal.company_name === "Oficina Teste")).toBe(
      true,
    );
  });

  it("keeps one or more phones on the negócio", async () => {
    const pipelines = await mockRepo.listCrmPipelines(USER);
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipelines[0]!.id,
      company_name: "Padaria Fone",
      phones: ["(34) 3333-1010"],
    });
    expect(created?.phones).toEqual(["(34) 3333-1010"]);
    const updated = await mockRepo.updateCrmDeal(USER, created!.id, {
      phones: ["(34) 99999-0000", "(34) 3333-2020"],
    });
    expect(updated?.phones).toEqual(["(34) 99999-0000", "(34) 3333-2020"]);
  });

  it("dedupes deals by CNPJ inside the same pipeline", async () => {
    const pipelines = await mockRepo.listCrmPipelines(USER);
    const pipelineId = pipelines[0]!.id;
    const first = await mockRepo.createCrmDeal(USER, {
      pipelineId,
      company_name: "Empresa A",
      cnpj: "12.345.678/0001-90",
    });
    const second = await mockRepo.createCrmDeal(USER, {
      pipelineId,
      company_name: "Empresa A duplicada",
      cnpj: "12345678000190",
    });
    expect(first?.id).toBeTruthy();
    expect(second?.id).toBe(first!.id);
    const found = await mockRepo.findCrmDealByCnpj(
      USER,
      pipelineId,
      "12345678000190",
    );
    expect(found?.id).toBe(first!.id);
  });
});

describe("seeded telemetry mix", () => {
  it("covers none, today, scheduled and overdue on the alimentos pista", async () => {
    const store = getMockStore();
    const pipeline = store.crm_pipelines.find(
      (row) => row.nome === "Indústria de Alimentos",
    );
    expect(pipeline).toBeTruthy();
    const board = await mockRepo.getCrmBoard(pipeline!.user_id, pipeline!.id);
    const signals = new Set(
      board!.deals.map((deal) => activitySignal(deal.next_activity)),
    );
    expect(signals.has("none")).toBe(true);
    expect(signals.has("today")).toBe(true);
    expect(signals.has("scheduled")).toBe(true);
    expect(signals.has("overdue")).toBe(true);
  });
});
