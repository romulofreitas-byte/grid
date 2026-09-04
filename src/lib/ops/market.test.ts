import { describe, expect, it } from "vitest";
import {
  countIntentOnly,
  rollupNiches,
  rollupNicheUf,
  rollupSegments,
  rollupUfs,
  type ExplodedSearch,
} from "./market";

const clinic = "clinic-id";
const odonto = "odonto-id";
const implante = "implante-id";

const rows: ExplodedSearch[] = [
  {
    nicheId: clinic,
    nicheNome: "Clínicas",
    segmentId: odonto,
    segmentNome: "Odontologia",
    uf: "SP",
    intentOnly: false,
  },
  {
    nicheId: clinic,
    nicheNome: "Clínicas",
    segmentId: odonto,
    segmentNome: "Odontologia",
    uf: "RJ",
    intentOnly: false,
  },
  {
    nicheId: clinic,
    nicheNome: "Clínicas",
    segmentId: implante,
    segmentNome: "Implante",
    uf: "SP",
    intentOnly: false,
  },
  {
    nicheId: clinic,
    nicheNome: "Clínicas",
    segmentId: odonto,
    segmentNome: "Odontologia",
    uf: "SP",
    intentOnly: false,
  },
  {
    nicheId: null,
    nicheNome: null,
    segmentId: null,
    segmentNome: null,
    uf: "MG",
    intentOnly: true,
  },
];

describe("ops market rollup", () => {
  it("sobe segmento para o nicho-pai", () => {
    expect(rollupNiches(rows)).toEqual([
      { id: clinic, nome: "Clínicas", count: 4 },
    ]);
  });

  it("conta cada UF explodida", () => {
    expect(rollupUfs(rows)).toEqual([
      { uf: "SP", count: 3 },
      { uf: "MG", count: 1 },
      { uf: "RJ", count: 1 },
    ]);
  });

  it("cruza nicho × UF", () => {
    expect(rollupNicheUf(rows)[0]).toEqual({
      nicheId: clinic,
      nicheNome: "Clínicas",
      uf: "SP",
      count: 3,
    });
  });

  it("separa segmentos e intenção livre", () => {
    expect(rollupSegments(rows).map((row) => row.id)).toEqual([odonto, implante]);
    expect(countIntentOnly(rows)).toBe(1);
  });
});
