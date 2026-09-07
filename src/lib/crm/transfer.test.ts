import { describe, expect, it } from "vitest";
import {
  dealAdvancementRank,
  mapTransferStageId,
  mergeDealNotes,
  mergeDealPhones,
  pickMergeSurvivor,
  pickOpenActivityKeepId,
  stageAdvancementRank,
} from "./transfer";

const entrada = {
  id: "entrada",
  nome: "Entrada de Lista",
  canonical_key: "entrada" as const,
};
const tentando = {
  id: "tentando",
  nome: "Tentando Contato",
  canonical_key: "tentando_contato" as const,
};
const custom = { id: "custom", nome: "Fila local", canonical_key: null };

describe("mapTransferStageId", () => {
  it("maps by canonical key, then nome, then Entrada", () => {
    const dest = [entrada, tentando, custom];
    expect(
      mapTransferStageId(
        { id: "x", nome: "Outro", canonical_key: "tentando_contato" },
        dest,
      ),
    ).toBe("tentando");
    expect(
      mapTransferStageId(
        { id: "x", nome: "Fila local", canonical_key: null },
        dest,
      ),
    ).toBe("custom");
    expect(
      mapTransferStageId(
        { id: "x", nome: "Faixa sumida", canonical_key: "negociacao" },
        dest,
      ),
    ).toBe("entrada");
  });

  it("returns null when the destination has no stages", () => {
    expect(mapTransferStageId(entrada, [])).toBeNull();
  });
});

describe("pickMergeSurvivor", () => {
  const base = {
    id: "a",
    pipeline_id: "p",
    stage_id: "s",
    notes: "",
    phones: [] as string[],
    amount_cents: null as number | null,
  };

  it("keeps the more advanced deal and the destination on a tie", () => {
    const source = { ...base, id: "src", outcome: "open" as const };
    const dest = { ...base, id: "dst", outcome: "open" as const };
    expect(pickMergeSurvivor(source, dest, tentando, entrada).id).toBe("src");
    expect(pickMergeSurvivor(source, dest, entrada, entrada).id).toBe("dst");
    expect(
      pickMergeSurvivor(
        { ...source, outcome: "won" },
        { ...dest, outcome: "open" },
        entrada,
        tentando,
      ).id,
    ).toBe("src");
  });
});

describe("dealAdvancementRank", () => {
  it("ranks won above open above lost, then by stage", () => {
    expect(dealAdvancementRank({ outcome: "won" }, entrada)).toBeGreaterThan(
      dealAdvancementRank({ outcome: "open" }, tentando),
    );
    expect(stageAdvancementRank("tentando_contato")).toBeGreaterThan(
      stageAdvancementRank("entrada"),
    );
  });
});

describe("mergeDealNotes", () => {
  it("keeps one side, skips duplicates, concatenates the rest", () => {
    expect(mergeDealNotes("  a  ", "")).toBe("a");
    expect(mergeDealNotes("", "b")).toBe("b");
    expect(mergeDealNotes("mesmo", "mesmo")).toBe("mesmo");
    expect(mergeDealNotes("um", "dois")).toBe("um\n\ndois");
  });
});

describe("mergeDealPhones", () => {
  it("dedupes phones from both deals", () => {
    expect(mergeDealPhones(["11999990000"], ["11999990000", "1133334444"])).toEqual(
      ["11999990000", "1133334444"],
    );
  });
});

describe("pickOpenActivityKeepId", () => {
  it("keeps the earliest open due and ignores done rows", () => {
    expect(
      pickOpenActivityKeepId([
        {
          id: "later",
          status: "open",
          due_at: "2026-09-08T12:00:00.000Z",
          created_at: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "done",
          status: "done",
          due_at: "2026-09-01T12:00:00.000Z",
          created_at: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "sooner",
          status: "open",
          due_at: "2026-09-07T12:00:00.000Z",
          created_at: "2026-09-02T00:00:00.000Z",
        },
      ]),
    ).toBe("sooner");
  });
});
