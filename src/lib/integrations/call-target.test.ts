import { describe, expect, it } from "vitest";
import {
  callViaLabel,
  pickCallConnection,
  testCallDestination,
  type CallConnectionPick,
} from "./call-target";

function conn(
  partial: Partial<CallConnectionPick> & Pick<CallConnectionPick, "id" | "kind">,
): CallConnectionPick {
  return {
    status: "active",
    provider: "webhook",
    display_name: partial.kind,
    catalog_id: null,
    caller_id: null,
    ...partial,
  };
}

describe("pickCallConnection", () => {
  it("prefers voip over dialer over webhook", () => {
    const picked = pickCallConnection([
      conn({ id: "crm", kind: "crm", display_name: "HubSpot" }),
      conn({ id: "hook", kind: "webhook", display_name: "Zapier" }),
      conn({ id: "dial", kind: "dialer", display_name: "3C Plus" }),
      conn({ id: "voip", kind: "voip", display_name: "Twilio" }),
    ]);
    expect(picked?.id).toBe("voip");
  });

  it("falls back to dialer then webhook", () => {
    expect(
      pickCallConnection([
        conn({ id: "hook", kind: "webhook" }),
        conn({ id: "dial", kind: "dialer" }),
      ])?.id,
    ).toBe("dial");
    expect(
      pickCallConnection([conn({ id: "hook", kind: "webhook" })])?.id,
    ).toBe("hook");
  });

  it("never picks CRM even if it is the only active connection", () => {
    expect(
      pickCallConnection([
        conn({ id: "crm", kind: "crm", display_name: "Pipedrive" }),
      ]),
    ).toBeNull();
  });

  it("skips inactive, error, and non-webhook providers", () => {
    expect(
      pickCallConnection([
        conn({ id: "dead", kind: "voip", status: "revoked" }),
        conn({ id: "err", kind: "dialer", status: "error" }),
        conn({
          id: "native",
          kind: "voip",
          provider: "twilio",
          display_name: "Twilio nativo",
        }),
        conn({ id: "ok", kind: "webhook", display_name: "Make" }),
      ])?.id,
    ).toBe("ok");
  });

  it("returns null when nothing is callable", () => {
    expect(pickCallConnection([])).toBeNull();
    expect(
      pickCallConnection([
        conn({ id: "pending", kind: "voip", status: "pending" }),
      ]),
    ).toBeNull();
  });
});

describe("callViaLabel", () => {
  it("names the destination", () => {
    expect(
      callViaLabel(conn({ id: "v", kind: "voip", display_name: "Twilio" })),
    ).toBe("Ligar via Twilio");
    expect(
      callViaLabel(conn({ id: "v", kind: "voip", display_name: "  " })),
    ).toBe("Ligar");
  });
});

describe("testCallDestination", () => {
  it("uses ramal on the connection", () => {
    expect(
      testCallDestination(conn({ id: "v", kind: "voip", caller_id: "1001" })),
    ).toEqual({ ok: true, to: "1001" });
  });

  it("rejects CRM and missing ramal", () => {
    expect(testCallDestination(conn({ id: "c", kind: "crm" })).ok).toBe(false);
    expect(testCallDestination(conn({ id: "v", kind: "voip" })).ok).toBe(false);
  });
});
