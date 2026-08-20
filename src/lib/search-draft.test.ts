import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "@/lib/types";
import {
  LARGADA_DRAFT_KEY,
  clearDraft,
  constrainLargadaFilters,
  draftHasWork,
  mergeFilters,
  readDraft,
  resolveLargadaSource,
  writeDraft,
  type DraftStorage,
  type LargadaDraft,
} from "./search-draft";

function memoryStorage(): DraftStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function draft(patch: Partial<LargadaDraft> = {}): LargadaDraft {
  return {
    filters: mergeFilters(patch.filters),
    step: patch.step ?? 1,
    intentDraft: patch.intentDraft ?? "",
    companyLabels: patch.companyLabels ?? {},
    cnaeLabels: patch.cnaeLabels ?? {},
    fromSearch: patch.fromSearch ?? null,
  };
}

describe("resolveLargadaSource", () => {
  it("prefers nova over fromSearch and draft", () => {
    expect(
      resolveLargadaSource({
        nova: true,
        fromSearch: "abc",
        hasDraft: true,
      }),
    ).toBe("nova");
  });

  it("prefers fromSearch over draft", () => {
    expect(
      resolveLargadaSource({
        nova: false,
        fromSearch: "abc",
        hasDraft: true,
      }),
    ).toBe("fromSearch");
  });

  it("uses draft when there is no query", () => {
    expect(
      resolveLargadaSource({
        nova: false,
        fromSearch: null,
        hasDraft: true,
      }),
    ).toBe("draft");
  });

  it("falls back to empty", () => {
    expect(
      resolveLargadaSource({
        nova: false,
        fromSearch: "",
        hasDraft: false,
      }),
    ).toBe("empty");
  });
});

describe("draftHasWork", () => {
  it("ignores a blank default draft", () => {
    expect(draftHasWork(draft())).toBe(false);
    expect(draftHasWork(null)).toBe(false);
  });

  it("detects step, intent, filters and fromSearch", () => {
    expect(draftHasWork(draft({ step: 2 }))).toBe(true);
    expect(draftHasWork(draft({ intentDraft: "clínicas" }))).toBe(true);
    expect(
      draftHasWork(draft({ filters: { ...DEFAULT_FILTERS, ufs: ["SP"] } })),
    ).toBe(true);
    expect(draftHasWork(draft({ fromSearch: "search-1" }))).toBe(true);
  });
});

describe("read/write/clear draft", () => {
  it("round-trips filters and clears the slot", () => {
    const storage = memoryStorage();
    writeDraft(
      draft({
        step: 3,
        intentDraft: "marmoraria",
        filters: { ...DEFAULT_FILTERS, segmentIds: ["marmoraria"], ufs: ["MG"] },
        fromSearch: "s1",
      }),
      storage,
    );
    const loaded = readDraft(storage);
    expect(loaded?.step).toBe(3);
    expect(loaded?.intentDraft).toBe("marmoraria");
    expect(loaded?.filters.segmentIds).toEqual(["marmoraria"]);
    expect(loaded?.filters.ufs).toEqual(["MG"]);
    expect(loaded?.fromSearch).toBe("s1");
    expect(loaded?.filters.ocultarTelefonesCompartilhados).toBe(true);

    clearDraft(storage);
    expect(readDraft(storage)).toBeNull();
  });

  it("merges partial stored filters with defaults", () => {
    const storage = memoryStorage();
    storage.setItem(
      LARGADA_DRAFT_KEY,
      JSON.stringify({ filters: { ufs: ["RJ"] }, step: 2 }),
    );
    const loaded = readDraft(storage);
    expect(loaded?.filters.ufs).toEqual(["RJ"]);
    expect(loaded?.filters.segmentIds).toEqual([]);
    expect(loaded?.filters.ocultarTelefonesCompartilhados).toBe(true);
  });
});

describe("constrainLargadaFilters", () => {
  it("keeps the first segment and first UF from old drafts", () => {
    const next = mergeFilters({
      segmentIds: ["clinicas", "marmoraria"],
      ufs: ["SP", "MG"],
      municipioIds: [1, 2],
    });
    expect(next.segmentIds).toEqual(["clinicas"]);
    expect(next.ufs).toEqual(["SP"]);
    expect(next.municipioIds).toEqual([]);
  });

  it("keeps cities when a single UF is already selected", () => {
    const next = constrainLargadaFilters({
      ...DEFAULT_FILTERS,
      segmentIds: ["clinicas"],
      ufs: ["MG"],
      municipioIds: [3106200],
    });
    expect(next.municipioIds).toEqual([3106200]);
  });
});
