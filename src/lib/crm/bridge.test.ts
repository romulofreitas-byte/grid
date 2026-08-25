import { describe, expect, it } from "vitest";
import {
  digitsCnpj,
  normalizePipelineNome,
  pistaNomeForSearch,
  resolveCrmPipelineNome,
} from "./bridge";
import { DEFAULT_PIPELINE_NAME } from "./cadence";

describe("resolveCrmPipelineNome", () => {
  it("prefers segment name over intent and list title", () => {
    expect(
      resolveCrmPipelineNome({
        segmentNome: "Clínicas estética",
        intentQuery: "outro",
        searchNome: "Lista · SP",
      }),
    ).toBe("Clínicas estética");
  });

  it("falls back to intent then stripped list nome", () => {
    expect(
      resolveCrmPipelineNome({
        segmentNome: null,
        intentQuery: "pet shop",
        searchNome: "Lista · pet shop",
      }),
    ).toBe("pet shop");
    expect(
      resolveCrmPipelineNome({
        segmentNome: null,
        intentQuery: null,
        searchNome: "Lista · Marmoraria",
      }),
    ).toBe("Marmoraria");
  });

  it("uses default when nothing useful", () => {
    expect(
      resolveCrmPipelineNome({
        segmentNome: "  ",
        intentQuery: "a",
        searchNome: "Lista · ",
      }),
    ).toBe(DEFAULT_PIPELINE_NAME);
  });
});

describe("pistaNomeForSearch", () => {
  it("matches a resolved nicho against existing pipelines", () => {
    const search = {
      nome: "Lista · Clínicas estética",
      filtros: { intentQuery: null as string | null },
    };
    expect(pistaNomeForSearch(search, ["Clínicas estética", "Contábil"])).toBe(
      "Clínicas estética",
    );
  });

  it("returns null when the pista was never created", () => {
    const search = {
      nome: "Lista · Padaria",
      filtros: { intentQuery: "padaria" },
    };
    expect(pistaNomeForSearch(search, ["Contábil"])).toBeNull();
  });
});

describe("normalizePipelineNome / digitsCnpj", () => {
  it("collapses whitespace and caps length", () => {
    expect(normalizePipelineNome("  Foo   Bar  ")).toBe("Foo Bar");
  });

  it("pads CNPJ digits", () => {
    expect(digitsCnpj("12.345.678/0001-90")).toBe("12345678000190");
  });
});
