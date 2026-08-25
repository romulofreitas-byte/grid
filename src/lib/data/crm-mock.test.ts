import { afterEach, describe, expect, it } from "vitest";
import { activitySignal } from "@/lib/crm/activity";
import { advanceCrmOnCall, moveLeadCrmFromFicha } from "@/lib/crm/lead-sync";
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

  it("creates the default cadence with canonical keys when asked", async () => {
    expect(await mockRepo.listCrmPipelines(USER)).toEqual([]);
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    expect(board?.stages.map((stage) => stage.nome)[0]).toBe("Entrada de Lista");
    expect(board?.stages).toHaveLength(11);
    expect(board?.stages[0]?.canonical_key).toBe("entrada");
    expect(board?.stages.at(-1)?.canonical_key).toBe("descartado");
  });

  it("refuses to delete a first-mile faixa", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const entrada = board!.stages.find((stage) => stage.canonical_key === "entrada")!;
    const other = board!.stages.find(
      (stage) => stage.canonical_key === "ajustando_proposta",
    )!;
    expect(await mockRepo.deleteCrmStage(USER, entrada.id, other.id)).toBe(false);
  });

  it("moves negócios to another faixa before deleting a custom faixa", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const pipelineId = pipeline.id;
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId,
      company_name: "Oficina Teste",
    });
    expect(created).toBeTruthy();
    const board = await mockRepo.getCrmBoard(USER, pipelineId);
    const from = board!.stages.find(
      (stage) => stage.canonical_key === "ajustando_proposta",
    )!;
    const to = board!.stages.find((stage) => stage.canonical_key === "entrada")!;
    const moved = await mockRepo.moveCrmDeal(USER, created!.id, from.id, 0);
    expect(moved?.stage_id).toBe(from.id);

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
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
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
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const pipelineId = pipeline.id;
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

  it("finds a deal by CNPJ across pipelines and advances from Entrada", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Empresa A",
      cnpj: "12345678000190",
    });
    const found = await mockRepo.findCrmDealByCnpjForUser(
      USER,
      "12345678000190",
      pipeline.id,
    );
    expect(found?.id).toBe(created!.id);
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const tentando = board!.stages.find(
      (stage) => stage.canonical_key === "tentando_contato",
    )!;
    const moved = await mockRepo.moveCrmDeal(USER, created!.id, tentando.id, 0);
    expect(moved?.stage_id).toBe(tentando.id);
    expect(await mockRepo.hasCrmPipeline(USER)).toBe(true);
    expect(await mockRepo.listCrmDealCnpjs(USER, ["12345678000190"])).toEqual([
      "12345678000190",
    ]);
  });

  it("advances Entrada to Tentando on call and refuses to leave R1 from the ficha", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Empresa Call",
      cnpj: "11111111000191",
    });
    const afterCall = await advanceCrmOnCall(mockRepo, {
      userId: USER,
      cnpj: "11111111000191",
    });
    expect(afterCall?.stageKey).toBe("tentando_contato");
    const again = await advanceCrmOnCall(mockRepo, {
      userId: USER,
      cnpj: "11111111000191",
    });
    expect(again?.stageKey).toBe("tentando_contato");

    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const r1 = board!.stages.find(
      (stage) => stage.canonical_key === "reuniao_realizada",
    )!;
    await mockRepo.moveCrmDeal(USER, created!.id, r1.id, 0);
    const refused = await moveLeadCrmFromFicha(mockRepo, {
      userId: USER,
      cnpj: "11111111000191",
      search: null,
      targetKey: "entrada",
    });
    expect(refused.crm?.stageKey).toBe("reuniao_realizada");
    expect(refused.crm?.pastFirstMile).toBe(true);
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
    const seedNow = new Date("2026-08-19T18:00:00.000Z");
    const signals = new Set(
      board!.deals.map((deal) => activitySignal(deal.next_activity, seedNow)),
    );
    expect(signals.has("none")).toBe(true);
    expect(signals.has("today")).toBe(true);
    expect(signals.has("scheduled")).toBe(true);
    expect(signals.has("overdue")).toBe(true);
  });
});
