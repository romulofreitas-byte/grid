import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, type Search } from "@/lib/types";
import {
  applySearchSaved,
  nextSavedVisibleCount,
  partitionSearches,
  removeSearch,
  SAVED_LISTS_PAGE_SIZE,
  setSearchSaved,
  UNSAVED_LIST_CAP,
  unsavedIdsToPrune,
} from "./searches";

function search(patch: Partial<Search> & Pick<Search, "id" | "saved">): Search {
  return {
    user_id: "user",
    nome: patch.id,
    filtros: DEFAULT_FILTERS,
    total_found: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

describe("partitionSearches", () => {
  it("keeps created_at order inside each bucket", () => {
    const rows = [
      search({ id: "new-unsaved", saved: false }),
      search({ id: "saved-a", saved: true }),
      search({ id: "old-unsaved", saved: false }),
      search({ id: "saved-b", saved: true }),
    ];
    expect(partitionSearches(rows)).toEqual({
      saved: [rows[1], rows[3]],
      unsaved: [rows[0], rows[2]],
    });
  });

  it("returns empty buckets when there are no searches", () => {
    expect(partitionSearches([])).toEqual({ saved: [], unsaved: [] });
  });
});

describe("setSearchSaved", () => {
  it("moves a search between buckets without reordering the others", () => {
    const rows = [
      search({ id: "a", saved: false }),
      search({ id: "b", saved: true }),
      search({ id: "c", saved: false }),
    ];
    const next = setSearchSaved(rows, "a", true);
    expect(partitionSearches(next)).toEqual({
      saved: [{ ...rows[0], saved: true }, rows[1]],
      unsaved: [rows[2]],
    });
  });

  it("leaves the list unchanged when the id is missing", () => {
    const rows = [search({ id: "a", saved: false })];
    expect(setSearchSaved(rows, "missing", true)).toEqual(rows);
  });
});

describe("removeSearch", () => {
  it("drops the matching search", () => {
    const rows = [
      search({ id: "keep", saved: true }),
      search({ id: "gone", saved: false }),
    ];
    expect(removeSearch(rows, "gone")).toEqual([rows[0]]);
  });
});

describe("unsavedIdsToPrune", () => {
  const rows = [
    { id: "newest", created_at: "2026-03-03T00:00:00.000Z" },
    { id: "mid", created_at: "2026-02-02T00:00:00.000Z" },
    { id: "oldest", created_at: "2026-01-01T00:00:00.000Z" },
  ];

  it("keeps the cap when listing", () => {
    expect(unsavedIdsToPrune(rows)).toEqual([]);
    expect(
      unsavedIdsToPrune([
        ...rows,
        { id: "ancient", created_at: "2025-12-01T00:00:00.000Z" },
      ]),
    ).toEqual(["ancient"]);
  });

  it("reserves a slot for a search about to be created", () => {
    expect(unsavedIdsToPrune(rows, { incoming: 1 })).toEqual(["oldest"]);
  });

  it("does not prune when there is room for a new search", () => {
    expect(unsavedIdsToPrune(rows.slice(0, 2), { incoming: 1 })).toEqual([]);
  });

  it("never prunes the list just unsaved", () => {
    expect(
      unsavedIdsToPrune(rows, {
        keepId: "old-saved",
        incoming: 0,
      }),
    ).toEqual(["oldest"]);
  });

  it("keeps an old unsaved id when it was just moved", () => {
    const withKeep = [
      ...rows,
      { id: "just-unsaved", created_at: "2025-01-01T00:00:00.000Z" },
    ];
    expect(unsavedIdsToPrune(withKeep, { keepId: "just-unsaved" })).toEqual([
      "oldest",
    ]);
  });

  it("uses the shared cap of 3", () => {
    expect(UNSAVED_LIST_CAP).toBe(3);
  });
});

describe("applySearchSaved", () => {
  it("puts a newly saved list first", () => {
    const rows = [
      search({ id: "saved-a", saved: true }),
      search({ id: "draft", saved: false }),
    ];
    expect(applySearchSaved(rows, "draft", true).map((row) => row.id)).toEqual([
      "draft",
      "saved-a",
    ]);
  });

  it("prunes the oldest other draft when unsaving past the cap", () => {
    const rows = [
      search({
        id: "newest",
        saved: false,
        created_at: "2026-03-03T00:00:00.000Z",
      }),
      search({
        id: "mid",
        saved: false,
        created_at: "2026-02-02T00:00:00.000Z",
      }),
      search({
        id: "oldest",
        saved: false,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      search({
        id: "was-saved",
        saved: true,
        created_at: "2025-06-01T00:00:00.000Z",
      }),
    ];
    const next = applySearchSaved(rows, "was-saved", false);
    expect(next.map((row) => row.id)).toEqual(["was-saved", "newest", "mid"]);
  });
});

describe("nextSavedVisibleCount", () => {
  it("grows by a page and stops at the total", () => {
    expect(SAVED_LISTS_PAGE_SIZE).toBe(6);
    expect(nextSavedVisibleCount(6, 14)).toBe(12);
    expect(nextSavedVisibleCount(12, 14)).toBe(14);
    expect(nextSavedVisibleCount(14, 14)).toBe(14);
  });
});
