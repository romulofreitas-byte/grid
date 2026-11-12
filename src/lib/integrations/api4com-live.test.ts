import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lookupApi4comCallEnded,
  matchApi4comCallEnded,
  type Api4comCallRow,
} from "./api4com-recording";

const ENDED: Api4comCallRow = {
  id: "2ee13fa4-975c-499d-bbb8-5177ff418316",
  recordUrl: null,
  dealId: null,
  startedAt: Date.parse("2026-11-12T15:00:00.000Z"),
  endedAt: Date.parse("2026-11-12T15:03:00.000Z"),
  hangupCause: "NORMAL_CLEARING",
  callRef: "ref-1",
};

describe("matchApi4comCallEnded", () => {
  it("sees a webphone hangup by call_ref when the dial id differs", () => {
    expect(
      matchApi4comCallEnded([ENDED], { vendorId: "dialer-1", callRef: "ref-1" }),
    ).toBe(true);
  });

  it("keeps the button live while the same call has not ended", () => {
    expect(
      matchApi4comCallEnded(
        [{ ...ENDED, endedAt: null, hangupCause: null }],
        { vendorId: "dialer-1", callRef: "ref-1" },
      ),
    ).toBe(false);
  });

  it("ignores a different finished call", () => {
    expect(
      matchApi4comCallEnded([ENDED], { vendorId: "dialer-1", callRef: "other" }),
    ).toBe(false);
  });
});

describe("lookupApi4comCallEnded", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the finished call from the API4COM list", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: ENDED.id,
                ended_at: "2026-11-12T15:03:00.000Z",
                hangup_cause: "NORMAL_CLEARING",
                metadata: { call_ref: "ref-1" },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    await expect(
      lookupApi4comCallEnded("tok", { vendorId: "dialer-1", callRef: "ref-1" }),
    ).resolves.toBe(true);
  });
});
