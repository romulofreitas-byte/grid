import { describe, expect, it } from "vitest";
import { cloneDefaultCadence, DEFAULT_CADENCE } from "./cadence";

describe("default cadence", () => {
  it("keeps the ten calling-pipeline faixas in order", () => {
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
    ]);
  });

  it("clones so a pipeline can rename without mutating the template", () => {
    const clone = cloneDefaultCadence();
    clone[0] = "Chegada";
    expect(DEFAULT_CADENCE[0]).toBe("Entrada de Lista");
  });
});
