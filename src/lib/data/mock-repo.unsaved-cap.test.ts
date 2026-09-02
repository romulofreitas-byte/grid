import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_USER_ID } from "@/lib/data/pg";
import { DEFAULT_FILTERS, type Search } from "@/lib/types";
import { mockRepo } from "./mock-repo";
import { getMockStore } from "./mock-store";

const USER = "unsaved-cap-user";

function row(
  id: string,
  createdAt: string,
  saved: boolean,
): Search {
  return {
    id,
    user_id: USER,
    nome: id,
    filtros: DEFAULT_FILTERS,
    total_found: 0,
    created_at: createdAt,
    saved,
  };
}

function cleanup() {
  const store = getMockStore();
  store.searches = store.searches.filter((s) => s.user_id !== USER);
  store.saved_leads = store.saved_leads.filter((l) => l.user_id !== USER);
}

describe("unsaved list cap", () => {
  afterEach(cleanup);

  it("filters recent searches by saved flag", async () => {
    const store = getMockStore();
    store.searches.push(
      row("draft", "2026-03-01T00:00:00.000Z", false),
      row("kept", "2026-03-01T00:00:00.000Z", true),
    );
    const unsaved = await mockRepo.listRecentSearches(USER, { saved: false });
    const saved = await mockRepo.listRecentSearches(USER, { saved: true });
    expect(unsaved.map((s) => s.id)).toEqual(["draft"]);
    expect(saved.map((s) => s.id)).toEqual(["kept"]);
  });

  it("trims leftover drafts down to three", async () => {
    const store = getMockStore();
    store.searches.push(
      row("newest", "2026-04-01T00:00:00.000Z", false),
      row("mid", "2026-03-01T00:00:00.000Z", false),
      row("old", "2026-02-01T00:00:00.000Z", false),
      row("ancient", "2026-01-01T00:00:00.000Z", false),
      row("saved-keep", "2026-01-01T00:00:00.000Z", true),
    );
    expect(await mockRepo.pruneUnsavedSearches(USER)).toEqual(["ancient"]);
    const unsaved = await mockRepo.listRecentSearches(USER, { saved: false });
    expect(unsaved.map((s) => s.id)).toEqual(["newest", "mid", "old"]);
    expect(store.searches.some((s) => s.id === "saved-keep")).toBe(true);
  });

  it("drops the oldest unsaved when a fourth search runs", async () => {
    const store = getMockStore();
    store.searches.push(
      row("oldest", "2026-01-01T00:00:00.000Z", false),
      row("mid", "2026-02-01T00:00:00.000Z", false),
      row("newest", "2026-03-01T00:00:00.000Z", false),
      row("saved-keep", "2026-01-01T00:00:00.000Z", true),
    );
    const created = await mockRepo.runSearch(USER, "Lista · nova", {
      ...DEFAULT_FILTERS,
    });
    const unsaved = await mockRepo.listRecentSearches(USER, { saved: false });
    expect(unsaved.map((s) => s.id).sort()).toEqual(
      [created.id, "mid", "newest"].sort(),
    );
    expect(store.searches.some((s) => s.id === "oldest")).toBe(false);
    expect(store.searches.some((s) => s.id === "saved-keep")).toBe(true);
  });

  it("keeps the list just unsaved and prunes another draft", async () => {
    const store = getMockStore();
    store.searches.push(
      row("newest", "2026-03-01T00:00:00.000Z", false),
      row("mid", "2026-02-01T00:00:00.000Z", false),
      row("oldest", "2026-01-01T00:00:00.000Z", false),
      row("was-saved", "2025-06-01T00:00:00.000Z", true),
    );
    await mockRepo.saveSearch("was-saved", { saved: false });
    const unsaved = await mockRepo.listRecentSearches(USER, { saved: false });
    expect(unsaved.map((s) => s.id).sort()).toEqual(
      ["was-saved", "newest", "mid"].sort(),
    );
    expect(store.searches.some((s) => s.id === "oldest")).toBe(false);
  });

  it("does not prune another user's drafts", async () => {
    const store = getMockStore();
    store.searches.push(
      row("mine-1", "2026-01-01T00:00:00.000Z", false),
      {
        ...row("theirs", "2026-01-01T00:00:00.000Z", false),
        user_id: LOCAL_USER_ID,
      },
    );
    await mockRepo.pruneUnsavedSearches(USER);
    expect(store.searches.some((s) => s.id === "theirs")).toBe(true);
  });
});
