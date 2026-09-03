import { describe, expect, it } from "vitest";
import {
  callAdvanceTarget,
  canMoveFromFicha,
  cloneDefaultCadence,
  DEFAULT_CADENCE,
  DEFAULT_CADENCE_ENTRIES,
  dispositionAdvanceTarget,
  firstMileStages,
  isLockedStageKey,
  isPastFirstMile,
  leadStatusFromStageKey,
  pickCreateStage,
  pickEntradaStage,
} from "./cadence";

describe("default cadence", () => {
  it("keeps the calling-pipeline faixas in order, ending in Descartado", () => {
    expect(DEFAULT_CADENCE).toEqual([
      "Entrada de Lista",
      "Tentando Contato",
      "Contato Respondido",
      "Follow UP Decisor",
      "Reunião Agendada",
      "Reunião Realizada (R1)",
      "Ajustando Proposta",
      "Proposta Apresentada (R2)",
      "Negociação e Fechamento",
      "Contrato fechado",
      "Descartado",
    ]);
    expect(DEFAULT_CADENCE_ENTRIES.map((entry) => entry.key)).toEqual([
      "entrada",
      "tentando_contato",
      "contato_respondido",
      "followup_decisor",
      "reuniao_agendada",
      "reuniao_realizada",
      "ajustando_proposta",
      "proposta_apresentada",
      "negociacao",
      "contrato_fechado",
      "descartado",
    ]);
  });

  it("clones so a pipeline can rename without mutating the template", () => {
    const clone = cloneDefaultCadence();
    clone[0] = "Chegada";
    expect(DEFAULT_CADENCE[0]).toBe("Entrada de Lista");
  });
});

describe("first-mile mapping", () => {
  it("mirrors saved_leads.status from the canonical key", () => {
    expect(leadStatusFromStageKey("entrada")).toBe("novo");
    expect(leadStatusFromStageKey("tentando_contato")).toBe("ligando");
    expect(leadStatusFromStageKey("followup_decisor")).toBe("ligando");
    expect(leadStatusFromStageKey("reuniao_agendada")).toBe("reuniao");
    expect(leadStatusFromStageKey("reuniao_realizada")).toBe("reuniao");
    expect(leadStatusFromStageKey("contrato_fechado")).toBe("reuniao");
    expect(leadStatusFromStageKey("descartado")).toBe("descartado");
  });

  it("auto-advances Ligar only from Entrada de Lista", () => {
    expect(callAdvanceTarget("entrada")).toBe("tentando_contato");
    expect(callAdvanceTarget("tentando_contato")).toBeNull();
    expect(callAdvanceTarget("reuniao_agendada")).toBeNull();
  });

  it("blocks ficha moves after Reunião Agendada", () => {
    expect(canMoveFromFicha("entrada", "reuniao_agendada")).toBe(true);
    expect(canMoveFromFicha("followup_decisor", "descartado")).toBe(true);
    expect(canMoveFromFicha("reuniao_realizada", "entrada")).toBe(false);
    expect(canMoveFromFicha("ajustando_proposta", "reuniao_agendada")).toBe(
      false,
    );
    expect(isPastFirstMile("reuniao_agendada")).toBe(false);
    expect(isPastFirstMile("reuniao_realizada")).toBe(true);
  });

  it("maps inbound dispositions without pulling a deal back from R1", () => {
    expect(dispositionAdvanceTarget("reuniao", "entrada")).toBe(
      "reuniao_agendada",
    );
    expect(dispositionAdvanceTarget("descartado", "tentando_contato")).toBe(
      "descartado",
    );
    expect(dispositionAdvanceTarget("ligando", "entrada")).toBe(
      "tentando_contato",
    );
    expect(dispositionAdvanceTarget("reuniao", "reuniao_realizada")).toBeNull();
  });

  it("locks first-mile and Descartado keys", () => {
    expect(isLockedStageKey("entrada")).toBe(true);
    expect(isLockedStageKey("descartado")).toBe(true);
    expect(isLockedStageKey("ajustando_proposta")).toBe(false);
  });

  it("orders ficha chips by canonical first-mile, not board position", () => {
    const stages = [
      { id: "d", canonical_key: "descartado" as const },
      { id: "r", canonical_key: "reuniao_agendada" as const },
      { id: "e", canonical_key: "entrada" as const },
      { id: "x", canonical_key: "ajustando_proposta" as const },
    ];
    expect(firstMileStages(stages).map((stage) => stage.id)).toEqual([
      "e",
      "r",
      "d",
    ]);
  });
});

describe("pickCreateStage", () => {
  const stages = [
    { id: "entrada", canonical_key: "entrada" as const },
    { id: "contato", canonical_key: "tentando_contato" as const },
  ];

  it("uses the requested stage when it belongs to the pipeline", () => {
    expect(pickCreateStage(stages, "contato")?.id).toBe("contato");
  });

  it("falls back to Entrada when stage_id is missing or foreign", () => {
    expect(pickCreateStage(stages)?.id).toBe("entrada");
    expect(pickCreateStage(stages, "other")?.id).toBe("entrada");
    expect(pickEntradaStage(stages)?.id).toBe("entrada");
  });
});
