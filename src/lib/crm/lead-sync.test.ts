import { describe, expect, it } from "vitest";
import { canMoveFromFicha } from "./cadence";
import { buildLeadCrmState } from "./lead-sync";

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
