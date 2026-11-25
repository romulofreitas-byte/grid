import { describe, expect, it } from "vitest";
import {
  digitsCnpj,
  latestPipelineNomeForList,
  nextSavedListPipelineNome,
  normalizePipelineNome,
  pickDefaultCrmPipeline,
  pipelineNomeForSeries,
  pipelineSeriesRank,
  pistaNomeForSearch,
  savedListPipelineBase,
} from "./bridge";
import { DEFAULT_PIPELINE_NAME } from "./cadence";

describe("saved list pipeline names", () => {
  it("uses the typed list title and falls back when it is empty", () => {
    expect(savedListPipelineBase("  Clínicas   BH  ")).toBe("Clínicas BH");
    expect(savedListPipelineBase("Lista · Marmoraria")).toBe(
      "Lista · Marmoraria",
    );
    expect(savedListPipelineBase("   ")).toBe(DEFAULT_PIPELINE_NAME);
  });

  it("keeps a numeric suffix inside 80 characters", () => {
    const base = "A".repeat(90);
    expect(pipelineNomeForSeries(base, 1)).toHaveLength(80);
    expect(pipelineNomeForSeries(base, 2)).toBe(`${"A".repeat(78)} 2`);
    expect(pipelineNomeForSeries(base, 2)).toHaveLength(80);
    expect(pipelineSeriesRank(pipelineNomeForSeries(base, 2), base)).toBe(2);
  });

  it("skips names that still exist and stops when one was deleted", async () => {
    const next = await nextSavedListPipelineNome(
      "Clínicas BH",
      ["Clínicas BH"],
      async () => false,
    );
    expect(next).toBe("Clínicas BH 2");

    const stopped = await nextSavedListPipelineNome(
      "Clínicas BH",
      ["Clínicas BH", "Clínicas BH 2"],
      async (candidate) => candidate === "Clínicas BH 3",
    );
    expect(stopped).toBeNull();

    const deletedBase = await nextSavedListPipelineNome(
      "Clínicas BH",
      [],
      async (candidate) => candidate === "Clínicas BH",
    );
    expect(deletedBase).toBeNull();
  });

  it("does not treat another list's suffix as this series", () => {
    expect(pipelineSeriesRank("Foo 2", "Foo 2")).toBe(1);
    expect(pipelineSeriesRank("Foo 2 2", "Foo 2")).toBe(2);
    expect(pipelineSeriesRank("Foo 22", "Foo 2")).toBeNull();
    expect(pipelineSeriesRank("Foo", "Foo 2")).toBeNull();
  });
});

describe("pistaNomeForSearch", () => {
  it("shows the latest pipeline of that list", () => {
    expect(
      pistaNomeForSearch({ nome: "Clínicas BH" }, [
        "Clínicas BH",
        "Clínicas BH 2",
        "Contábil",
      ]),
    ).toBe("Clínicas BH 2");
    expect(
      latestPipelineNomeForList("Clínicas BH", ["Contábil"]),
    ).toBeNull();
  });

  it("does not map a list onto a niche pipeline with another name", () => {
    expect(
      pistaNomeForSearch({ nome: "Padaria do Zé" }, [
        DEFAULT_PIPELINE_NAME,
        "Contábil",
      ]),
    ).toBeNull();
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
