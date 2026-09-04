import { describe, expect, it } from "vitest";
import { aggregatePainel } from "./aggregate";
import type { PainelSnapshot } from "./types";

const NOW = new Date("2026-09-03T18:00:00.000Z");

function snapshot(patch: Partial<PainelSnapshot> = {}): PainelSnapshot {
  return {
    now: NOW,
    range: "30d",
    pipelineId: null,
    callGoal: 20,
    callCreatedAt: [],
    searches: [],
    leads: [],
    pipelines: [{ id: "p1", nome: "Nicho", openDeals: 0 }],
    deals: [],
    activities: [],
    outcomeEvents: [],
    ...patch,
  };
}

describe("aggregatePainel", () => {
  it("counts funnel reach, open pipeline value, and period faturado from outcome date", () => {
    const metrics = aggregatePainel(
      snapshot({
        deals: [
          {
            id: "d-entrada",
            company_name: "Entrada Ltda",
            pipeline_id: "p1",
            stage_id: "s-entrada",
            stage_nome: "Entrada de Lista",
            canonical_key: "entrada",
            outcome: "open",
            amount_cents: 100000,
            created_at: "2026-09-01T12:00:00.000Z",
            updated_at: "2026-09-01T12:00:00.000Z",
          },
          {
            id: "d-reuniao",
            company_name: "Reunião Ltda",
            pipeline_id: "p1",
            stage_id: "s-reuniao",
            stage_nome: "Reunião Agendada",
            canonical_key: "reuniao_agendada",
            outcome: "open",
            amount_cents: 250000,
            created_at: "2026-09-01T12:00:00.000Z",
            updated_at: "2026-09-01T12:00:00.000Z",
          },
          {
            id: "d-won",
            company_name: "Ganho Ltda",
            pipeline_id: "p1",
            stage_id: "s-contrato",
            stage_nome: "Contrato fechado",
            canonical_key: "contrato_fechado",
            outcome: "won",
            amount_cents: 400000,
            created_at: "2026-08-01T12:00:00.000Z",
            updated_at: "2026-09-02T12:00:00.000Z",
          },
          {
            id: "d-won-old",
            company_name: "Ganho antigo",
            pipeline_id: "p1",
            stage_id: "s-contrato",
            stage_nome: "Contrato fechado",
            canonical_key: "contrato_fechado",
            outcome: "won",
            amount_cents: 900000,
            created_at: "2026-01-01T12:00:00.000Z",
            updated_at: "2026-01-02T12:00:00.000Z",
          },
          {
            id: "d-won-empty",
            company_name: "Ganho sem valor",
            pipeline_id: "p1",
            stage_id: "s-contrato",
            stage_nome: "Contrato fechado",
            canonical_key: "contrato_fechado",
            outcome: "won",
            amount_cents: null,
            created_at: "2026-09-01T12:00:00.000Z",
            updated_at: "2026-09-01T12:00:00.000Z",
          },
        ],
        outcomeEvents: [
          {
            deal_id: "d-won",
            created_at: "2026-09-02T12:00:00.000Z",
            outcome: "won",
          },
          {
            deal_id: "d-won-old",
            created_at: "2026-01-02T12:00:00.000Z",
            outcome: "won",
          },
          {
            deal_id: "d-won-empty",
            created_at: "2026-09-01T15:00:00.000Z",
            outcome: "won",
          },
        ],
      }),
    );

    const funnel = Object.fromEntries(metrics.funnel.map((step) => [step.id, step.count]));
    expect(funnel.entrada).toBe(5);
    expect(funnel.tentou).toBe(4);
    expect(funnel.reuniao).toBe(4);
    expect(funnel.proposta).toBe(3);
    expect(funnel.ganhou).toBe(3);
    expect(metrics.kpis.pipelineOpenCents).toBe(350000);
    expect(metrics.kpis.openWithAmount).toBe(2);
    expect(metrics.kpis.billedPeriodCents).toBe(400000);
    expect(metrics.kpis.wonPeriod).toBe(2);
    expect(metrics.kpis.wonWithoutAmount).toBe(1);
  });

  it("counts overdue follow-ups as a call to action", () => {
    const metrics = aggregatePainel(
      snapshot({
        deals: [
          {
            id: "d1",
            company_name: "Atrasada",
            pipeline_id: "p1",
            stage_id: "s1",
            stage_nome: "Tentando Contato",
            canonical_key: "tentando_contato",
            outcome: "open",
            amount_cents: null,
            created_at: "2026-09-01T12:00:00.000Z",
            updated_at: "2026-09-01T12:00:00.000Z",
          },
          {
            id: "d2",
            company_name: "Sem volta",
            pipeline_id: "p1",
            stage_id: "s1",
            stage_nome: "Tentando Contato",
            canonical_key: "tentando_contato",
            outcome: "open",
            amount_cents: null,
            created_at: "2026-09-01T12:00:00.000Z",
            updated_at: "2026-09-01T12:00:00.000Z",
          },
        ],
        activities: [
          {
            deal_id: "d1",
            kind: "ligar",
            due_at: "2026-09-01T12:00:00.000Z",
            status: "open",
          },
        ],
      }),
    );
    expect(metrics.kpis.overdueFollowups).toBe(1);
    expect(metrics.kpis.openWithoutNext).toBe(1);
    expect(metrics.tasks[0]?.kind).toBe("overdue");
    expect(metrics.tasks[0]?.subtitle).toMatch(/ligar/i);
    expect(metrics.followups.find((row) => row.id === "none")?.value).toBe(1);
  });

  it("merges open pipeline bars by canonical stage across niches", () => {
    const metrics = aggregatePainel(
      snapshot({
        pipelines: [
          { id: "p1", nome: "Alimentos", openDeals: 2 },
          { id: "p2", nome: "Vidro", openDeals: 1 },
        ],
        deals: [
          {
            id: "a",
            company_name: "A",
            pipeline_id: "p1",
            stage_id: "s-a",
            stage_nome: "Entrada de Lista",
            canonical_key: "entrada",
            outcome: "open",
            amount_cents: null,
            created_at: "2026-09-01T12:00:00.000Z",
            updated_at: "2026-09-01T12:00:00.000Z",
          },
          {
            id: "b",
            company_name: "B",
            pipeline_id: "p2",
            stage_id: "s-b",
            stage_nome: "Entrada de Lista",
            canonical_key: "entrada",
            outcome: "open",
            amount_cents: null,
            created_at: "2026-09-01T12:00:00.000Z",
            updated_at: "2026-09-01T12:00:00.000Z",
          },
          {
            id: "c",
            company_name: "C",
            pipeline_id: "p1",
            stage_id: "s-c",
            stage_nome: "Reunião Agendada",
            canonical_key: "reuniao_agendada",
            outcome: "open",
            amount_cents: null,
            created_at: "2026-09-01T12:00:00.000Z",
            updated_at: "2026-09-01T12:00:00.000Z",
          },
        ],
      }),
    );
    expect(metrics.pipeline.map((row) => [row.id, row.value])).toEqual([
      ["entrada", 2],
      ["reuniao_agendada", 1],
    ]);
  });
});
