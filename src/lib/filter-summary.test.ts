import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "@/lib/types";
import {
  filterStepFilled,
  qualityDiffersFromDefault,
  segmentNameMap,
  summarizeFilters,
  summarizeFiltersShort,
} from "./filter-summary";

const names = {
  clinicas: "Clínica odontológica",
  marmoraria: "Marmoraria",
};

function filters(
  patch: Partial<typeof DEFAULT_FILTERS> = {},
): typeof DEFAULT_FILTERS {
  return { ...DEFAULT_FILTERS, ...patch };
}

describe("summarizeFilters", () => {
  it("uses segment names and region, skipping default quality", () => {
    const chips = summarizeFilters(
      filters({
        segmentIds: ["clinicas"],
        ufs: ["SP", "MG"],
      }),
      names,
    );
    expect(chips.map((c) => c.label)).toEqual([
      "Clínica odontológica",
      "SP, MG",
    ]);
  });

  it("counts unnamed segments and extra CNAEs, companies, cities", () => {
    const chips = summarizeFilters(
      filters({
        segmentIds: ["unknown-a", "unknown-b"],
        cnaes: ["8630-5/03"],
        cnpjs: ["123"],
        ufs: ["SP"],
        municipioIds: [1, 2, 3],
      }),
    );
    expect(chips.map((c) => c.label)).toEqual([
      "2 segmentos",
      "1 empresa",
      "1 CNAE",
      "SP",
      "3 cidades",
    ]);
  });

  it("only lists quality that differs from defaults", () => {
    const chips = summarizeFilters(
      filters({
        ocultarTelefonesCompartilhados: false,
        ocultarEmailsGratuitos: true,
        soMatriz: true,
        exigirDecisor: true,
        idadeMinimaAnos: 5,
        portes: ["01"],
      }),
    );
    expect(chips.map((c) => c.label)).toEqual([
      "incluir telefone compartilhado",
      "sem e-mail gratuito",
      "ME · micro",
      "5 anos+",
      "só matriz",
      "com decisor",
    ]);
  });

  it("labels already-qualified filter", () => {
    const chips = summarizeFilters(filters({ soEnriquecidas: true }));
    expect(chips.map((c) => c.label)).toContain("só qualificadas");
  });

  it("joins a short line with a cap", () => {
    const line = summarizeFiltersShort(
      filters({
        segmentIds: ["clinicas", "marmoraria"],
        intentQuery: "indústria química",
        ufs: ["SP"],
        soMatriz: true,
      }),
      names,
      4,
    );
    expect(line).toBe(
      "Clínica odontológica · Marmoraria · indústria química · SP",
    );
  });

  it("tolerates null filter arrays and a non-list niche tree", () => {
    const chips = summarizeFilters({
      ...DEFAULT_FILTERS,
      segmentIds: null as unknown as string[],
      cnaes: null as unknown as string[],
      cnpjs: null as unknown as string[],
      ufs: null as unknown as string[],
      municipioIds: null as unknown as number[],
      portes: null as unknown as never[],
    });
    expect(chips.map((c) => c.label)).toEqual([]);
    expect(segmentNameMap({ error: "nope" })).toEqual({});
    expect(segmentNameMap(null)).toEqual({});
  });
});

describe("filterStepFilled", () => {
  it("marks niche, region and non-default quality", () => {
    expect(filterStepFilled(1, DEFAULT_FILTERS)).toBe(false);
    expect(filterStepFilled(1, filters({ segmentIds: ["clinicas"] }))).toBe(
      true,
    );
    expect(filterStepFilled(2, DEFAULT_FILTERS)).toBe(false);
    expect(filterStepFilled(2, filters({ ufs: ["SP"] }))).toBe(true);
    expect(filterStepFilled(3, DEFAULT_FILTERS)).toBe(false);
    expect(filterStepFilled(3, filters({ soMatriz: true }))).toBe(true);
  });
});

describe("qualityDiffersFromDefault", () => {
  it("treats shared-phone hide as the default", () => {
    expect(qualityDiffersFromDefault(DEFAULT_FILTERS)).toBe(false);
    expect(
      qualityDiffersFromDefault(
        filters({ ocultarTelefonesCompartilhados: false }),
      ),
    ).toBe(true);
  });
});
