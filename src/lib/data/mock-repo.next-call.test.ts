import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, type SavedLead, type Search } from "@/lib/types";
import { mockRepo } from "./mock-repo";
import { getMockStore } from "./mock-store";

const USER = "box-pista-user";

function search(id: string, saved: boolean, createdAt: string): Search {
  return {
    id,
    user_id: USER,
    nome: id,
    filtros: DEFAULT_FILTERS,
    total_found: 1,
    created_at: createdAt,
    saved,
  };
}

function lead(id: string, searchId: string, cnpj: string): SavedLead {
  return {
    id,
    search_id: searchId,
    user_id: USER,
    cnpj,
    grid_score: 10,
    grid_position: 1,
    enrichment: null,
    status: "novo",
    notas: null,
    created_at: "2026-08-17T12:00:00.000Z",
  };
}

describe("findNextCallLead", () => {
  afterEach(() => {
    const store = getMockStore();
    store.searches = store.searches.filter((s) => s.user_id !== USER);
    store.saved_leads = store.saved_leads.filter((l) => l.user_id !== USER);
  });

  it("ignores unsaved searches even when they have a P novo", async () => {
    const store = getMockStore();
    const est = store.establishments[0]!;
    store.searches.push(
      search("unsaved-grid", false, "2026-08-17T14:00:00.000Z"),
    );
    store.saved_leads.push(lead("lead-unsaved", "unsaved-grid", est.cnpj));

    expect(await mockRepo.findNextCallLead(USER)).toBeNull();
  });

  it("returns the first novo on a saved list", async () => {
    const store = getMockStore();
    const est = store.establishments[0]!;
    store.searches.push(
      search("unsaved-grid", false, "2026-08-17T14:00:00.000Z"),
      search("saved-grid", true, "2026-08-17T13:00:00.000Z"),
    );
    store.saved_leads.push(
      lead("lead-unsaved", "unsaved-grid", est.cnpj),
      lead("lead-saved", "saved-grid", est.cnpj),
    );

    const next = await mockRepo.findNextCallLead(USER);
    expect(next?.searchId).toBe("saved-grid");
    expect(next?.cnpj).toBe(est.cnpj);
    expect(next?.gridPosition).toBe(1);
  });
});
