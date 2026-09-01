import { describe, expect, it } from "vitest";
import {
  digitsCnpj,
  normalizePipelineNome,
  pickDefaultCrmPipeline,
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

  it("ignores CNAE/company names on a CNPJ-only avulsa list", () => {
    expect(
      resolveCrmPipelineNome({
        segmentNome: null,
        intentQuery: "Comércio varejista de mercadorias em geral",
        searchNome: "Padaria do Zé",
        cnpjOnly: true,
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

  it("maps a CNPJ-only list to Meu nicho", () => {
    const search = {
      nome: "Padaria do Zé",
      filtros: {
        intentQuery: "Padaria e confeitaria",
        cnpjs: ["12345678000190"],
        segmentIds: [] as string[],
      },
    };
    expect(pistaNomeForSearch(search, [DEFAULT_PIPELINE_NAME, "Contábil"])).toBe(
      DEFAULT_PIPELINE_NAME,
    );
  });
});

describe("pickDefaultCrmPipeline", () => {
  it("prefers the pista with more deals over an empty first pista", () => {
    expect(
      pickDefaultCrmPipeline([
        { id: "empty", deal_count: 0 },
        { id: "busy", deal_count: 3 },
        { id: "other", deal_count: 1 },
      ])?.id,
    ).toBe("busy");
  });

  it("falls back to the first pista when all are empty", () => {
    expect(
      pickDefaultCrmPipeline([
        { id: "first", deal_count: 0 },
        { id: "second", deal_count: 0 },
      ])?.id,
    ).toBe("first");
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
