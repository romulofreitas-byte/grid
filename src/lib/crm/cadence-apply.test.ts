import { describe, expect, it } from "vitest";
import {
  orderAppliedCadence,
  planApplyCadence,
  type CadenceApplyStage,
} from "./cadence-apply";

function stage(
  id: string,
  nome: string,
  canonical_key: string | null = null,
): CadenceApplyStage {
  return { id, nome, canonical_key };
}

describe("planApplyCadence", () => {
  it("renames dest stages that share a canonical key", () => {
    const plan = planApplyCadence(
      [stage("s1", "Ligando", "tentando_contato")],
      [stage("d1", "Tentando Contato", "tentando_contato")],
    );
    expect(plan.renames).toEqual([{ id: "d1", nome: "Ligando" }]);
    expect(plan.creates).toEqual([]);
  });

  it("creates custom stages the dest does not have, without duplicating names", () => {
    expect(
      planApplyCadence(
        [stage("s1", "Pós-contrato")],
        [stage("d1", "pós-contrato")],
      ),
    ).toEqual({
      renames: [{ id: "d1", nome: "Pós-contrato" }],
      creates: [],
    });
    expect(
      planApplyCadence([stage("s1", "Pós-contrato")], []).creates,
    ).toEqual(["Pós-contrato"]);
  });

  it("does not invent a canonical stage the dest is missing", () => {
    const plan = planApplyCadence(
      [stage("s1", "Entrada de Lista", "entrada")],
      [stage("d1", "Tentando Contato", "tentando_contato")],
    );
    expect(plan.creates).toEqual([]);
    expect(plan.renames).toEqual([]);
  });
});

describe("orderAppliedCadence", () => {
  it("follows the source order and keeps unmatched dest stages at the end", () => {
    const dest = [
      stage("entrada", "Entrada", "entrada"),
      stage("extra", "Só aqui"),
      stage("tentando", "Tentando", "tentando_contato"),
    ];
    expect(
      orderAppliedCadence(
        [
          stage("s2", "Tentando", "tentando_contato"),
          stage("s1", "Entrada", "entrada"),
        ],
        dest,
      ),
    ).toEqual(["tentando", "entrada", "extra"]);
  });
});
