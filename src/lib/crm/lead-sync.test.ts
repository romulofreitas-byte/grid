import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS, type Search } from "@/lib/types";
import { canMoveFromFicha } from "./cadence";
import {
  buildLeadCrmState,
  preferredCrmPipelineId,
  type LeadCrmRepo,
} from "./lead-sync";

describe("buildLeadCrmState", () => {
  const stages = [
    { id: "s-entrada", nome: "Entrada de Lista", canonical_key: "entrada" },
    {
      id: "s-tentando",
      nome: "Tentando Contato",
      canonical_key: "tentando_contato",
    },
    {
      id: "s-reuniao",
      nome: "Reunião Agendada",
      canonical_key: "reuniao_agendada",
    },
    {
      id: "s-r1",
      nome: "Reunião Realizada (R1)",
      canonical_key: "reuniao_realizada",
    },
    { id: "s-lost", nome: "Descartado", canonical_key: "descartado" },
  ];

  it("exposes first-mile chips and not R1", () => {
    const crm = buildLeadCrmState(
      "Clínicas",
      {
        id: "d1",
        pipeline_id: "p1",
        stage_id: "s-entrada",
        notes: "oi",
      },
      stages,
    );
    expect(crm.pipelineNome).toBe("Clínicas");
    expect(crm.stageKey).toBe("entrada");
    expect(crm.pastFirstMile).toBe(false);
    expect(crm.firstMile.map((stage) => stage.key)).toEqual([
      "entrada",
      "tentando_contato",
      "reuniao_agendada",
      "descartado",
    ]);
    expect(crm.notes).toBe("oi");
  });

  it("marks pastFirstMile after Reunião Agendada", () => {
    const crm = buildLeadCrmState(
      "Clínicas",
      {
        id: "d1",
        pipeline_id: "p1",
        stage_id: "s-r1",
        notes: "",
      },
      stages,
    );
    expect(crm.pastFirstMile).toBe(true);
    expect(crm.stageNome).toBe("Reunião Realizada (R1)");
    expect(canMoveFromFicha(crm.stageKey, "entrada")).toBe(false);
  });
});

describe("preferredCrmPipelineId", () => {
  it("prefers the latest pipeline named after the list", async () => {
    const repo = {
      listCrmPipelines: vi.fn().mockResolvedValue([
        { id: "old", nome: "Clínicas BH" },
        { id: "latest", nome: "Clínicas BH 2" },
        { id: "other", nome: "Contábil" },
      ]),
    } as unknown as LeadCrmRepo;
    const search: Search = {
      id: "s",
      user_id: "u",
      nome: "Clínicas BH",
      filtros: DEFAULT_FILTERS,
      total_found: 1,
      created_at: "2026-09-01T00:00:00.000Z",
      saved: true,
    };
    await expect(preferredCrmPipelineId(repo, "u", search)).resolves.toBe(
      "latest",
    );
    await expect(preferredCrmPipelineId(repo, "u", null)).resolves.toBeNull();
  });
});
