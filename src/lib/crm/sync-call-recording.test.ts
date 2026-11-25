import { describe, expect, it } from "vitest";
import { recordingSyncDue } from "@/lib/crm/events";
import { parseApi4comCallList } from "@/lib/integrations/api4com-recording";
import { pickRecordingForEvent } from "./sync-call-recording";
import type { CrmEvent } from "./types";

const MP3 = "https://listener.api4com.com/files/listen/call.mp3";

function event(partial: Partial<CrmEvent> & Pick<CrmEvent, "meta">): CrmEvent {
  return {
    id: "e1",
    deal_id: "deal-1",
    kind: "ligar",
    body: "",
    created_at: "2026-10-15T18:00:00.000Z",
    updated_at: "2026-10-15T18:00:00.000Z",
    ...partial,
  };
}

describe("parseApi4comCallList", () => {
  it("reads record_url from the calls list", () => {
    const rows = parseApi4comCallList({
      data: [
        {
          id: "call-1",
          record_url: MP3,
          started_at: "2026-10-15T18:00:05.000Z",
          metadata: { deal_id: "deal-1" },
        },
      ],
    });
    expect(rows).toEqual([
      {
        id: "call-1",
        recordUrl: MP3,
        dealId: "deal-1",
        startedAt: Date.parse("2026-10-15T18:00:05.000Z"),
        endedAt: null,
        hangupCause: null,
        callRef: null,
      },
    ]);
  });

  it("reads the spaced API4COM timestamp", () => {
    const rows = parseApi4comCallList([
      {
        id: "call-1",
        recordUrl: MP3,
        startedAt: "2025-01-01 00:00:00",
        endedAt: "2025-01-01 00:00:10",
      },
    ]);
    expect(rows[0]?.startedAt).toBe(Date.parse("2025-01-01T00:00:00"));
    expect(rows[0]?.endedAt).toBe(Date.parse("2025-01-01T00:00:10"));
  });
});

describe("pickRecordingForEvent", () => {
  it("uses the file of the same call id", () => {
    const picked = pickRecordingForEvent(
      event({ meta: { call_id: "call-1" } }),
      "deal-1",
      [
        {
          id: "call-1",
          recordUrl: MP3,
          dealId: "deal-1",
          startedAt: Date.parse("2026-10-15T18:00:05.000Z"),
        },
      ],
      new Set(),
    );
    expect(picked).toEqual({ recordUrl: MP3, callId: "call-1" });
  });

  it("pins a late file on the history row when the dialer id differs", () => {
    const picked = pickRecordingForEvent(
      event({ meta: { call_id: "dialer-id" } }),
      "deal-1",
      [
        {
          id: "real-call",
          recordUrl: MP3,
          dealId: "deal-1",
          startedAt: Date.parse("2026-10-15T18:01:00.000Z"),
        },
      ],
      new Set(),
    );
    expect(picked?.recordUrl).toBe(MP3);
    expect(picked?.callId).toBe("dialer-id");
  });

  it("uses the call_ref file when the dialer row has none", () => {
    const picked = pickRecordingForEvent(
      event({ meta: { call_id: "dialer-id", call_ref: "cr-1" } }),
      "deal-1",
      [
        {
          id: "dialer-id",
          recordUrl: null,
          dealId: "deal-1",
          startedAt: Date.parse("2026-10-15T18:00:00.000Z"),
        },
        {
          id: "real-call",
          recordUrl: MP3,
          dealId: "deal-1",
          startedAt: Date.parse("2026-10-15T18:01:00.000Z"),
          callRef: "cr-1",
        },
      ],
      new Set(),
    );
    expect(picked).toEqual({ recordUrl: MP3, callId: "dialer-id" });
  });

  it("keeps looking when the dialer row has no file", () => {
    const picked = pickRecordingForEvent(
      event({ meta: { call_id: "dialer-id" } }),
      "deal-1",
      [
        {
          id: "dialer-id",
          recordUrl: null,
          dealId: null,
          startedAt: Date.parse("2026-10-15T18:00:00.000Z"),
        },
        {
          id: "real-call",
          recordUrl: MP3,
          dealId: "deal-1",
          startedAt: Date.parse("2026-10-15T18:01:00.000Z"),
        },
      ],
      new Set(),
    );
    expect(picked?.recordUrl).toBe(MP3);
    expect(picked?.callId).toBe("dialer-id");
  });
});

describe("recordingSyncDue", () => {
  it("asks again until the file is saved", () => {
    const now = Date.parse("2026-10-15T18:10:00.000Z");
    expect(
      recordingSyncDue(event({ meta: { call_id: "call-1" } }), now),
    ).toBe(true);
    expect(
      recordingSyncDue(
        event({ meta: { call_id: "call-1", record_url: MP3 } }),
        now,
      ),
    ).toBe(false);
    expect(
      recordingSyncDue(
        event({
          meta: {
            call_id: "call-1",
            recording_checked_at: "2026-10-15T18:09:50.000Z",
          },
        }),
        now,
      ),
    ).toBe(false);
  });
});
