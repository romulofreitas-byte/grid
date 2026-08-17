import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, type Search } from "@/lib/types";
import { partitionSearches, removeSearch, setSearchSaved } from "./searches";

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
