import { describe, expect, it } from "vitest";
import {
  CRM_EVENT_HISTORY_LIMIT,
  callRecordingReady,
  closedDealCount,
  eventTitle,
  formatEventWhen,
  readCrmEventMeta,
  visibleKanbanDeals,
} from "./events";
import type { CrmDealCard, CrmEvent } from "./types";

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
    open_activities: [],
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

describe("readCrmEventMeta", () => {
  it("keeps call_id and the https recording for the history player", () => {
    expect(
      readCrmEventMeta({
        call_id: " 2ee13fa4-975c-499d-bbb8-5177ff418316 ",
        record_url:
          "https://listener.api4com.com/files/listen/2ee13fa4-975c-499d-bbb8-5177ff418316.mp3",
        phone: "11999990000",
        extra: "nope",
      }),
    ).toEqual({
      call_id: "2ee13fa4-975c-499d-bbb8-5177ff418316",
      record_url:
        "https://listener.api4com.com/files/listen/2ee13fa4-975c-499d-bbb8-5177ff418316.mp3",
      phone: "11999990000",
    });
    expect(readCrmEventMeta({ record_url: "http://listener.api4com.com/x.mp3" })).toEqual(
      {},
    );
    expect(readCrmEventMeta({ call_id: "" })).toEqual({});
  });
});

describe("callRecordingReady", () => {
  const event = (meta: CrmEvent["meta"]): CrmEvent => ({
    id: "e",
    deal_id: "d",
    kind: "ligar",
    body: "",
    meta,
    created_at: "2026-09-01T12:00:00.000Z",
    updated_at: "2026-09-01T12:00:00.000Z",
  });

  it("is ready only when this call already has a recording", () => {
    const callId = "2ee13fa4-975c-499d-bbb8-5177ff418316";
    expect(
      callRecordingReady(
        [event({ call_id: callId, record_url: "https://listener.api4com.com/a.mp3" })],
        callId,
      ),
    ).toBe(true);
    expect(callRecordingReady([event({ call_id: callId })], callId)).toBe(false);
    expect(
      callRecordingReady(
        [event({ record_url: "https://listener.api4com.com/a.mp3" })],
        callId,
      ),
    ).toBe(false);
  });
});
