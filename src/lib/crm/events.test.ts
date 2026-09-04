import { describe, expect, it } from "vitest";
import {
  CRM_EVENT_HISTORY_LIMIT,
  closedDealCount,
  eventTitle,
  formatEventWhen,
  visibleKanbanDeals,
} from "./events";
import type { CrmDealCard } from "./types";

function deal(outcome: CrmDealCard["outcome"]): CrmDealCard {
  return {
    id: outcome,
    pipeline_id: "p",
    stage_id: "s",
    company_name: outcome,
    contact_name: "",
    secretaries: [],
    people: [],
    phones: [],
    notes: "",
    cnpj: null,
    meta: {},
    outcome,
    amount_cents: null,
    position: 0,
    created_at: "2026-09-01T12:00:00.000Z",
    updated_at: "2026-09-01T12:00:00.000Z",
    next_activity: null,
  };
}

describe("crm events copy", () => {
  it("names a won outcome in the feed", () => {
    expect(
      eventTitle({ kind: "outcome", meta: { outcome: "won" } }),
    ).toBe("Marcado como ganho");
    expect(eventTitle({ kind: "ligar", meta: {} })).toBe("Ligação feita");
    expect(eventTitle({ kind: "email", meta: {} })).toBe("E-mail enviado");
  });

  it("formats the created stamp in pt-BR", () => {
    expect(formatEventWhen("2026-08-18T18:23:00.000Z")).toMatch(/18\/ago/i);
  });
});

describe("kanban outcome filter", () => {
  const deals = [deal("open"), deal("won"), deal("lost")];

  it("keeps only em andamento by default", () => {
    expect(visibleKanbanDeals(deals, false).map((row) => row.outcome)).toEqual([
      "open",
    ]);
    expect(closedDealCount(deals)).toBe(2);
  });

  it("shows closed deals when asked", () => {
    expect(visibleKanbanDeals(deals, true)).toHaveLength(3);
  });

  it("keeps the history feed bounded", () => {
    expect(CRM_EVENT_HISTORY_LIMIT).toBe(50);
  });
});
