import { afterEach, describe, expect, it } from "vitest";
import { activitySignal } from "@/lib/crm/activity";
import { advanceCrmOnCall, moveLeadCrmFromFicha } from "@/lib/crm/lead-sync";
import {
  executePipelineRemoval,
  loadPipelineRemovalPreview,
} from "@/lib/crm/pipeline-removal";
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
    store.crm_events = store.crm_events.filter((row) => {
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

  it("lists stages without assembling the full board", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const stages = await mockRepo.listCrmStages(USER, pipeline.id);
    expect(stages).toHaveLength(11);
    expect(stages?.[0]?.canonical_key).toBe("entrada");
    expect(await mockRepo.listCrmStages(USER, "missing")).toBeNull();
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

  it("creates on a requested stage when it belongs to the pipeline", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const tentando = board!.stages.find(
      (stage) => stage.canonical_key === "tentando_contato",
    )!;
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Oficina Na Faixa",
      stage_id: tentando.id,
    });
    expect(created?.stage_id).toBe(tentando.id);
  });

  it("falls back to Entrada when stage_id is missing or foreign", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const other = await mockRepo.createCrmPipeline(USER, "Outro nicho");
    const otherBoard = await mockRepo.getCrmBoard(USER, other.id);
    const foreign = otherBoard!.stages[1]!.id;
    const omitted = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Sem faixa",
    });
    const fallback = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Faixa de outro nicho",
      stage_id: foreign,
    });
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const entrada = board!.stages.find((stage) => stage.canonical_key === "entrada")!;
    expect(omitted?.stage_id).toBe(entrada.id);
    expect(fallback?.stage_id).toBe(entrada.id);
  });

  it("stores people with email on create", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Maria",
      people: [{ name: "Maria", phone: "11981887766", email: "maria@x.com" }],
      meta: { source: "import" },
    });
    expect(created?.people[0]).toEqual({
      name: "Maria",
      phone: "11981887766",
      email: "maria@x.com",
    });
    expect(created?.contact_name).toBe("Maria");
    expect(created?.phones).toContain("11981887766");
    expect(created?.meta.source).toBe("import");
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

  it("appends call events instead of overwriting notes and keeps the open volta", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Padaria Histórico",
      notes: "Primeira conversa.",
    });
    const first = await mockRepo.logCrmCall(USER, created!.id, "Não atendeu.");
    expect(first?.event.kind).toBe("ligar");
    expect(first?.deal.notes).toBe("Não atendeu.");
    expect(first?.deal.next_activity).toBeNull();
    const second = await mockRepo.logCrmCall(USER, created!.id, "Falou com a secretária.");
    expect(second?.deal.notes).toBe("Falou com a secretária.");
    const events = await mockRepo.listCrmEvents(USER, created!.id);
    expect(events?.map((row) => row.body)).toEqual([
      "Falou com a secretária.",
      "Não atendeu.",
      "Primeira conversa.",
    ]);
    expect(events?.filter((row) => row.kind === "ligar")).toHaveLength(2);
  });

  it("schedules the next volta without a history item", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Só Agendar",
    });
    const dueAt = new Date("2026-09-02T15:00:00.000Z").toISOString();
    await mockRepo.scheduleCrmActivity(USER, created!.id, "whatsapp", dueAt);
    const events = await mockRepo.listCrmEvents(USER, created!.id);
    expect(events).toEqual([]);
    const card = await mockRepo.getCrmBoard(USER, pipeline.id);
    const deal = card?.deals.find((row) => row.id === created!.id);
    expect(deal?.next_activity?.kind).toBe("whatsapp");
  });

  it("marks the open volta as done and writes it to the histórico", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Concluir volta",
    });
    const dueAt = new Date("2026-09-02T15:00:00.000Z").toISOString();
    await mockRepo.scheduleCrmActivity(USER, created!.id, "followup", dueAt);
    const none = await mockRepo.completeCrmActivity(
      USER,
      "missing",
      "00000000-0000-4000-8000-000000000001",
    );
    expect(none).toBeNull();
    const empty = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Sem volta",
    });
    const skipped = await mockRepo.completeCrmActivity(
      USER,
      empty!.id,
      "00000000-0000-4000-8000-000000000001",
    );
    expect(skipped?.event).toBeNull();
    expect(skipped?.deal.next_activity).toBeNull();
    const open = (await mockRepo.getCrmDeal(USER, created!.id))!.next_activity!;
    const done = await mockRepo.completeCrmActivity(USER, created!.id, open.id);
    expect(done?.event?.kind).toBe("followup");
    expect(done?.deal.next_activity).toBeNull();
    const events = await mockRepo.listCrmEvents(USER, created!.id);
    expect(events?.[0]?.kind).toBe("followup");
  });

  it("hides won and lost deals from the active pista unless asked", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Fechou",
    });
    const won = await mockRepo.setCrmDealOutcome(USER, created!.id, "won");
    expect(won?.deal.outcome).toBe("won");
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    const { visibleKanbanDeals, closedDealCount } = await import("@/lib/crm/events");
    expect(visibleKanbanDeals(board!.deals, false)).toHaveLength(0);
    expect(visibleKanbanDeals(board!.deals, true)).toHaveLength(1);
    expect(closedDealCount(board!.deals)).toBe(1);
    const events = await mockRepo.listCrmEvents(USER, created!.id);
    expect(events?.[0]?.kind).toBe("outcome");
  });

  it("persists deal amount_cents including clear", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Com valor",
    });
    expect(created?.amount_cents).toBeNull();
    const priced = await mockRepo.updateCrmDeal(USER, created!.id, {
      amount_cents: 150000,
    });
    expect(priced?.amount_cents).toBe(150000);
    const cleared = await mockRepo.updateCrmDeal(USER, created!.id, {
      amount_cents: null,
    });
    expect(cleared?.amount_cents).toBeNull();
  });

  it("persists people with email and phone and snapshots contact_name", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Pessoas",
      contact_name: "Ana",
      secretaries: ["Bia"],
    });
    expect(created?.people.map((row) => row.name)).toEqual(["Ana"]);
    expect(created?.secretaries).toEqual([
      { name: "Bia", phone: "", email: "" },
    ]);
    const updated = await mockRepo.updateCrmDeal(USER, created!.id, {
      people: [
        { name: "Carlos", phone: "(34) 99999-0000", email: "c@x.com" },
        { name: "Bia", phone: "(34) 3333-2020", email: "" },
      ],
    });
    expect(updated?.people[0]).toEqual({
      name: "Carlos",
      phone: "(34) 99999-0000",
      email: "c@x.com",
    });
    expect(updated?.contact_name).toBe("Carlos");
    expect(updated?.secretaries).toEqual([
      { name: "Bia", phone: "", email: "" },
    ]);
    const renamed = await mockRepo.updateCrmDeal(USER, created!.id, {
      people: [{ name: "Diego", phone: "", email: "" }],
    });
    expect(renamed?.contact_name).toBe("Diego");
    expect(renamed?.secretaries).toEqual([
      { name: "Bia", phone: "", email: "" },
    ]);
  });

  it("schedules a dated note as next_activity and leaves undated notes alone", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Nota agendada",
    });
    const dueAt = new Date("2026-09-02T17:00:00-03:00").toISOString();
    const dated = await mockRepo.createCrmEvent(USER, created!.id, {
      kind: "nota",
      body: "Voltar na sexta.",
      next: { kind: "nota", dueAt },
    });
    expect(dated?.deal.next_activity?.kind).toBe("nota");
    expect(
      activitySignal(
        dated!.deal.next_activity,
        new Date("2026-09-02T15:00:00-03:00"),
      ),
    ).toBe("today");

    const scheduled = await mockRepo.scheduleCrmActivity(
      USER,
      created!.id,
      "whatsapp",
      new Date("2026-09-05T15:00:00.000Z").toISOString(),
    );
    expect(scheduled?.next_activity?.kind).toBe("nota");
    expect(scheduled?.open_activities).toHaveLength(2);
    const undated = await mockRepo.createCrmEvent(USER, created!.id, {
      kind: "nota",
      body: "Só um recado.",
    });
    expect(undated?.deal.next_activity?.kind).toBe("nota");
    expect(undated?.deal.open_activities).toHaveLength(2);
  });

  it("logs a WhatsApp without replacing an overdue call", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Não apaga",
    });
    const overdue = new Date("2026-08-01T15:00:00.000Z").toISOString();
    const later = new Date("2026-09-20T15:00:00.000Z").toISOString();
    await mockRepo.scheduleCrmActivity(USER, created!.id, "ligar", overdue);
    const logged = await mockRepo.createCrmEvent(USER, created!.id, {
      kind: "whatsapp",
      body: "Mandei o áudio.",
    });
    expect(logged?.deal.next_activity?.kind).toBe("ligar");
    expect(logged?.deal.open_activities).toHaveLength(1);
    const events = await mockRepo.listCrmEvents(USER, created!.id);
    expect(events?.some((row) => row.kind === "whatsapp")).toBe(true);
    const meeting = await mockRepo.scheduleCrmActivity(
      USER,
      created!.id,
      "reuniao",
      later,
    );
    expect(meeting?.open_activities.map((row) => row.kind)).toEqual([
      "ligar",
      "reuniao",
    ]);
    expect(meeting?.next_activity?.kind).toBe("ligar");
    const ligar = meeting!.open_activities.find((row) => row.kind === "ligar")!;
    const done = await mockRepo.completeCrmActivity(
      USER,
      created!.id,
      ligar.id,
    );
    expect(done?.deal.next_activity?.kind).toBe("reuniao");
    expect(done?.deal.open_activities).toHaveLength(1);
    const reuniao = done!.deal.open_activities[0]!;
    const beforeEvents = await mockRepo.listCrmEvents(USER, created!.id);
    const snoozed = await mockRepo.rescheduleCrmActivity(
      USER,
      created!.id,
      reuniao.id,
      "reuniao",
      new Date("2026-09-22T15:00:00.000Z").toISOString(),
    );
    expect(snoozed?.open_activities).toHaveLength(1);
    expect(snoozed?.open_activities[0]?.id).toBe(reuniao.id);
    expect(snoozed?.next_activity?.due_at).toBe(
      new Date("2026-09-22T15:00:00.000Z").toISOString(),
    );
    const afterEvents = await mockRepo.listCrmEvents(USER, created!.id);
    expect(afterEvents).toHaveLength(beforeEvents!.length);
  });

  it("reorders pipelines and lists them in the new order", async () => {
    const first = await mockRepo.createCrmPipeline(USER, "Nicho A");
    const second = await mockRepo.createCrmPipeline(USER, "Nicho B");
    const third = await mockRepo.createCrmPipeline(USER, "Nicho C");
    expect(await mockRepo.reorderCrmPipelines(USER, [third.id, first.id, second.id])).toBe(
      true,
    );
    expect((await mockRepo.listCrmPipelines(USER)).map((row) => row.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
    expect((await mockRepo.listCrmPipelines(USER)).map((row) => row.position)).toEqual([
      0, 1, 2,
    ]);
  });

  it("keeps cadence edits inside one pipeline", async () => {
    const a = await mockRepo.createCrmPipeline(USER, "Nicho A");
    const b = await mockRepo.createCrmPipeline(USER, "Nicho B");
    const boardA = await mockRepo.getCrmBoard(USER, a.id);
    const snapshotB = (await mockRepo.getCrmBoard(USER, b.id))!.stages.map(
      (stage) => ({
        id: stage.id,
        nome: stage.nome,
        position: stage.position,
        canonical_key: stage.canonical_key,
      }),
    );

    const tentando = boardA!.stages.find(
      (stage) => stage.canonical_key === "tentando_contato",
    )!;
    expect(
      await mockRepo.updateCrmStage(USER, tentando.id, {
        nome: "Primeira ligação",
      }),
    ).toBeTruthy();

    const extra = await mockRepo.createCrmStage(USER, a.id, "Pós-contrato");
    expect(extra).toBeTruthy();
    const afterAdd = await mockRepo.getCrmBoard(USER, a.id);
    const ids = afterAdd!.stages.map((stage) => stage.id);
    expect(
      await mockRepo.reorderCrmStages(USER, a.id, [
        ids[ids.length - 1]!,
        ...ids.slice(0, -1),
      ]),
    ).toBe(true);
    expect(await mockRepo.deleteCrmStage(USER, extra!.id)).toBe(true);

    const boardB = await mockRepo.getCrmBoard(USER, b.id);
    expect(
      boardB!.stages.map((stage) => ({
        id: stage.id,
        nome: stage.nome,
        position: stage.position,
        canonical_key: stage.canonical_key,
      })),
    ).toEqual(snapshotB);

    const boardAAfter = await mockRepo.getCrmBoard(USER, a.id);
    expect(
      boardAAfter!.stages.find((stage) => stage.id === tentando.id)?.nome,
    ).toBe("Primeira ligação");
    expect(
      boardAAfter!.stages.some((stage) => stage.nome === "Pós-contrato"),
    ).toBe(false);
    expect(boardAAfter!.stages).toHaveLength(snapshotB.length);
  });

  it("rejects incomplete or foreign pipeline reorder lists", async () => {
    const first = await mockRepo.createCrmPipeline(USER, "Nicho A");
    const second = await mockRepo.createCrmPipeline(USER, "Nicho B");
    expect(await mockRepo.reorderCrmPipelines(USER, [second.id])).toBe(false);
    expect(
      await mockRepo.reorderCrmPipelines(USER, [
        first.id,
        second.id,
        "00000000-0000-4000-8000-000000000099",
      ]),
    ).toBe(false);
    expect((await mockRepo.listCrmPipelines(USER)).map((row) => row.id)).toEqual([
      first.id,
      second.id,
    ]);
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

  it("caps event history at the feed limit", async () => {
    const { CRM_EVENT_HISTORY_LIMIT } = await import("@/lib/crm/events");
    const pipeline = await mockRepo.createCrmPipeline(USER, "Nicho teste");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Histórico longo",
    });
    for (let i = 0; i < CRM_EVENT_HISTORY_LIMIT + 3; i += 1) {
      await mockRepo.logCrmCall(USER, created!.id, `Ligação ${i}`);
    }
    const events = await mockRepo.listCrmEvents(USER, created!.id);
    expect(events).toHaveLength(CRM_EVENT_HISTORY_LIMIT);
    expect(events?.[0]?.body).toBe(`Ligação ${CRM_EVENT_HISTORY_LIMIT + 2}`);
  });

  it("loads a slim briefing lookup without assembling a dossier", async () => {
    const store = getMockStore();
    const est = store.establishments[0];
    expect(est).toBeTruthy();
    const lookup = await mockRepo.getCrmBriefingLookup(est!.cnpj);
    expect(lookup).toBeTruthy();
    expect(lookup?.municipioNome).toBeTruthy();
    expect(Array.isArray(lookup?.extraPhones)).toBe(true);
    expect(Array.isArray(lookup?.sourcedPhones)).toBe(true);
    expect(lookup?.presence === null || typeof lookup?.presence?.site === "boolean").toBe(
      true,
    );
    expect(Array.isArray(lookup?.socios)).toBe(true);
    expect((lookup?.socios?.length ?? 0) > 0).toBe(true);
  });

  it("searches deals across pipelines and keeps the other user out", async () => {
    const otherUser = "crm-search-other";
    const alimentos = await mockRepo.createCrmPipeline(USER, "Alimentos");
    const contabil = await mockRepo.createCrmPipeline(USER, "Contábil");
    const mine = await mockRepo.createCrmDeal(USER, {
      pipelineId: alimentos.id,
      company_name: "Padaria Aurora",
      contact_name: "Ana Carvalho",
      phones: ["(34) 99999-0000"],
      cnpj: "12345678000190",
    });
    const otherNicho = await mockRepo.createCrmDeal(USER, {
      pipelineId: contabil.id,
      company_name: "Contábil Aurora",
    });
    const won = await mockRepo.createCrmDeal(USER, {
      pipelineId: contabil.id,
      company_name: "Padaria Encerrada",
    });
    await mockRepo.setCrmDealOutcome(USER, won!.id, "won");
    const otherPipe = await mockRepo.createCrmPipeline(otherUser, "Nicho alheio");
    await mockRepo.createCrmDeal(otherUser, {
      pipelineId: otherPipe.id,
      company_name: "Padaria Secreta",
    });

    const byName = await mockRepo.searchCrmDeals(USER, "aurora", {
      preferredPipelineId: alimentos.id,
    });
    expect(byName.map((hit) => hit.dealId)).toEqual([mine!.id, otherNicho!.id]);
    expect(byName[0]?.pipelineNome).toBe("Alimentos");
    expect(byName[1]?.pipelineNome).toBe("Contábil");

    const closed = await mockRepo.searchCrmDeals(USER, "encerrada");
    expect(closed).toHaveLength(1);
    expect(closed[0]?.dealId).toBe(won!.id);
    expect(closed[0]?.outcome).toBe("won");

    const byPhone = await mockRepo.searchCrmDeals(USER, "349999");
    expect(byPhone.map((hit) => hit.dealId)).toEqual([mine!.id]);

    const leaked = await mockRepo.searchCrmDeals(otherUser, "aurora");
    expect(leaked).toEqual([]);
    expect(
      (await mockRepo.searchCrmDeals(USER, "secreta")).map((hit) => hit.company_name),
    ).toEqual([]);

    const store = getMockStore();
    store.crm_deals = store.crm_deals.filter(
      (row) => row.pipeline_id !== otherPipe.id,
    );
    store.crm_stages = store.crm_stages.filter(
      (row) => row.pipeline_id !== otherPipe.id,
    );
    store.crm_pipelines = store.crm_pipelines.filter(
      (row) => row.user_id !== otherUser,
    );
  });
});

describe("crm deal transfer and list entrada", () => {
  afterEach(() => {
    const store = getMockStore();
    const ids = new Set(
      store.crm_pipelines.filter((row) => row.user_id === USER).map((row) => row.id),
    );
    store.crm_activities = store.crm_activities.filter((row) => {
      const deal = store.crm_deals.find((d) => d.id === row.deal_id);
      return !deal || !ids.has(deal.pipeline_id);
    });
    store.crm_events = store.crm_events.filter((row) => {
      const deal = store.crm_deals.find((d) => d.id === row.deal_id);
      return !deal || !ids.has(deal.pipeline_id);
    });
    store.crm_deals = store.crm_deals.filter((row) => !ids.has(row.pipeline_id));
    store.crm_stages = store.crm_stages.filter((row) => !ids.has(row.pipeline_id));
    store.crm_pipelines = store.crm_pipelines.filter((row) => row.user_id !== USER);
  });

  it("moves a deal to the matching stage on another nicho", async () => {
    const from = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const to = await mockRepo.createCrmPipeline(USER, "Contábil");
    const created = await mockRepo.createCrmDeal(USER, {
      pipelineId: from.id,
      company_name: "Clínica Alfa",
      cnpj: "12345678000190",
    });
    const fromBoard = await mockRepo.getCrmBoard(USER, from.id);
    const tentando = fromBoard!.stages.find(
      (stage) => stage.canonical_key === "tentando_contato",
    )!;
    await mockRepo.moveCrmDeal(USER, created!.id, tentando.id, 0);
    const out = await mockRepo.transferCrmDeal(USER, created!.id, to.id);
    expect(out?.merged).toBe(false);
    expect(out?.deal.pipeline_id).toBe(to.id);
    const dest = await mockRepo.getCrmBoard(USER, to.id);
    const destStage = dest!.stages.find((stage) => stage.id === out?.deal.stage_id);
    expect(destStage?.canonical_key).toBe("tentando_contato");
  });

  it("merges into the more advanced CNPJ and keeps the earlier open activity", async () => {
    const from = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const to = await mockRepo.createCrmPipeline(USER, "Contábil");
    const source = await mockRepo.createCrmDeal(USER, {
      pipelineId: from.id,
      company_name: "Clínica Fonte",
      cnpj: "12345678000191",
      notes: "da lista",
    });
    const dest = await mockRepo.createCrmDeal(USER, {
      pipelineId: to.id,
      company_name: "Clínica Destino",
      cnpj: "12345678000191",
      notes: "do quadro",
    });
    const destBoard = await mockRepo.getCrmBoard(USER, to.id);
    const reuniao = destBoard!.stages.find(
      (stage) => stage.canonical_key === "reuniao_agendada",
    )!;
    await mockRepo.moveCrmDeal(USER, dest!.id, reuniao.id, 0);
    await mockRepo.scheduleCrmActivity(
      USER,
      source!.id,
      "ligar",
      "2026-09-10T12:00:00.000Z",
    );
    await mockRepo.scheduleCrmActivity(
      USER,
      dest!.id,
      "whatsapp",
      "2026-09-08T12:00:00.000Z",
    );
    const out = await mockRepo.transferCrmDeal(USER, source!.id, to.id);
    expect(out?.merged).toBe(true);
    expect(out?.deal.id).toBe(dest!.id);
    expect(out?.deal.notes).toMatch(/do quadro/);
    expect(out?.deal.notes).toMatch(/da lista/);
    expect(out?.deal.open_activities).toHaveLength(1);
    expect(out?.deal.open_activities[0]?.kind).toBe("whatsapp");
    expect(await mockRepo.getCrmDeal(USER, source!.id)).toBeNull();
  });

  it("removes only GRID Entrada deals from a deleted list", async () => {
    const pipeline = await mockRepo.createCrmPipeline(USER, "Clínicas");
    const searchId = "11111111-1111-4111-8111-111111111111";
    const grid = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Grid Lead",
      cnpj: "12345678000192",
      meta: { searchId, source: "qualify_bridge" },
    });
    const imported = await mockRepo.createCrmDeal(USER, {
      pipelineId: pipeline.id,
      company_name: "Import Lead",
      meta: { searchId, source: "import" },
    });
    expect(imported?.id).not.toBe(grid?.id);
    expect(imported?.meta.source).toBe("import");
    expect(await mockRepo.countCrmEntradaDealsForSearch(USER, searchId)).toBe(1);
    expect(await mockRepo.deleteCrmEntradaDealsForSearch(USER, searchId)).toBe(1);
    const board = await mockRepo.getCrmBoard(USER, pipeline.id);
    expect(board?.deals.map((deal) => deal.company_name)).toEqual(["Import Lead"]);
  });

  it("deletes a GRID-only Entrada nicho and transfers when a deal has advanced", async () => {
    const from = await mockRepo.createCrmPipeline(USER, "Origem");
    const to = await mockRepo.createCrmPipeline(USER, "Destino");
    const entrada = await mockRepo.createCrmDeal(USER, {
      pipelineId: from.id,
      company_name: "Só GRID",
      meta: { source: "qualify_bridge" },
    });
    const preview = await loadPipelineRemovalPreview(mockRepo, USER, from.id);
    expect(preview?.canDeleteDirectly).toBe(true);
    const fromBoard = await mockRepo.getCrmBoard(USER, from.id);
    const tentando = fromBoard!.stages.find(
      (stage) => stage.canonical_key === "tentando_contato",
    )!;
    await mockRepo.moveCrmDeal(USER, entrada!.id, tentando.id, 0);
    const blocked = await executePipelineRemoval(mockRepo, USER, from.id);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) throw new Error("expected block");
    expect(blocked.status).toBe(409);
    const moved = await executePipelineRemoval(
      mockRepo,
      USER,
      from.id,
      to.id,
    );
    expect(moved.ok).toBe(true);
    expect(await mockRepo.getCrmBoard(USER, from.id)).toBeNull();
    const dest = await mockRepo.getCrmBoard(USER, to.id);
    expect(dest?.deals.some((deal) => deal.company_name === "Só GRID")).toBe(
      true,
    );
  });
});
