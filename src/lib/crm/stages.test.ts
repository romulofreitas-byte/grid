import { describe, expect, it } from "vitest";
import { planDeleteStage } from "./stages";

const stages = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("planDeleteStage", () => {
  it("blocks deleting the last faixa", () => {
    expect(
      planDeleteStage({
        stages: [{ id: "a" }],
        stageId: "a",
        dealCount: 0,
      }),
    ).toEqual({
      ok: false,
      error: "O CRM precisa de pelo menos uma faixa.",
    });
  });

  it("asks where to move negócios when the faixa is not empty", () => {
    expect(
      planDeleteStage({
        stages,
        stageId: "b",
        dealCount: 2,
      }),
    ).toEqual({
      ok: false,
      error: "Escolha para onde vão os negócios desta faixa.",
    });
  });

  it("moves negócios to another faixa then allows delete", () => {
    expect(
      planDeleteStage({
        stages,
        stageId: "b",
        dealCount: 2,
        moveToStageId: "c",
      }),
    ).toEqual({ ok: true, moveToStageId: "c" });
  });

  it("deletes an empty faixa without a move target", () => {
    expect(
      planDeleteStage({
        stages,
        stageId: "a",
        dealCount: 0,
      }),
    ).toEqual({ ok: true, moveToStageId: null });
  });

  it("blocks deleting a first-mile or Descartado faixa", () => {
    expect(
      planDeleteStage({
        stages: [
          { id: "a", canonical_key: "entrada" },
          { id: "b", canonical_key: "ajustando_proposta" },
        ],
        stageId: "a",
        dealCount: 0,
      }),
    ).toEqual({
      ok: false,
      error: "Esta faixa faz parte da ficha. Dá para renomear, não apagar.",
    });
  });
});
