import { describe, expect, it } from "vitest";
import {
  MUNICIPIO_MULTI_UF_CAP,
  filterMunicipios,
  municipioLetter,
  municipioLetters,
  municipioListLimit,
} from "./municipios";

const list = [
  { id: 1, nome: "Belo Horizonte", uf: "MG" },
  { id: 2, nome: "Betim", uf: "MG" },
  { id: 3, nome: "Divinópolis", uf: "MG" },
  { id: 4, nome: "Uberlândia", uf: "MG" },
  { id: 5, nome: "Águas Formosas", uf: "MG" },
];

describe("municipioListLimit", () => {
  it("drops the cap for a single UF", () => {
    expect(municipioListLimit(1)).toBeNull();
    expect(municipioListLimit(0)).toBe(MUNICIPIO_MULTI_UF_CAP);
    expect(municipioListLimit(2)).toBe(MUNICIPIO_MULTI_UF_CAP);
  });
});

describe("municipioLetter", () => {
  it("strips accents and uses A–Z", () => {
    expect(municipioLetter("Águas Formosas")).toBe("A");
    expect(municipioLetter("Belo Horizonte")).toBe("B");
    expect(municipioLetter("Divinópolis")).toBe("D");
  });
});

describe("filterMunicipios", () => {
  it("filters from one character", () => {
    const hits = filterMunicipios(list, { q: "B" });
    const names = hits.map((m) => m.nome);
    expect(names).toContain("Belo Horizonte");
    expect(names).toContain("Betim");
    expect(names).not.toContain("Divinópolis");
  });

  it("filters by letter chip", () => {
    const hits = filterMunicipios(list, { letter: "D" });
    expect(hits.map((m) => m.nome)).toEqual(["Divinópolis"]);
  });

  it("intersects letter and query", () => {
    const hits = filterMunicipios(list, { letter: "B", q: "bet" });
    expect(hits.map((m) => m.nome)).toEqual(["Betim"]);
  });
});

describe("municipioLetters", () => {
  it("lists distinct first letters", () => {
    expect(municipioLetters(list)).toEqual(["A", "B", "D", "U"]);
  });
});
