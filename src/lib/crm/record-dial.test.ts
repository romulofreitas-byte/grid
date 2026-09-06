import { afterEach, describe, expect, it, vi } from "vitest";
import { recordCrmDialAfterCall } from "./record-dial";
import type { CrmDealCard } from "./types";

function deal(overrides: Partial<CrmDealCard> = {}): CrmDealCard {
  return {
    id: "deal-1",
    pipeline_id: "p1",
    stage_id: "s1",
    company_name: "Acme",
    contact_name: "Ana",
    secretaries: [],
    people: [],
    phones: ["(11) 4123-3244"],
    notes: "",
    cnpj: "12345678000199",
    meta: {},
    outcome: "open",
    amount_cents: null,
    position: 0,
    created_at: "2026-09-01T12:00:00.000Z",
    updated_at: "2026-09-01T12:00:00.000Z",
    next_activity: null,
    ...overrides,
  };
}

describe("recordCrmDialAfterCall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("completes an open ligar activity", async () => {
    const updated = deal({ next_activity: null });
    const event = {
      id: "e1",
      deal_id: "deal-1",
      kind: "ligar" as const,
      body: "",
      meta: {},
      created_at: "2026-09-01T12:00:00.000Z",
      updated_at: "2026-09-01T12:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deal: updated, event }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await recordCrmDialAfterCall(
      deal({
        next_activity: {
          id: "a1",
          deal_id: "deal-1",
          kind: "ligar",
          due_at: "2026-09-05T18:00:00.000Z",
          status: "open",
          created_at: "2026-09-01T12:00:00.000Z",
        },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/crm/deals/deal-1/complete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.deal).toEqual(updated);
    expect(result.event).toEqual(event);
  });

  it("logs a profile call when there is no ligar activity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const card = deal({ next_activity: null });
    const result = await recordCrmDialAfterCall(card);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile/call",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.deal).toEqual(card);
    expect(result.event).toBeNull();
    expect(result.events).toEqual([]);
  });

  it("skips profile call when there is no CNPJ", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const card = deal({ cnpj: null, next_activity: null });
    const result = await recordCrmDialAfterCall(card);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.deal).toEqual(card);
  });
});
