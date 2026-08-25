import { describe, expect, it } from "vitest";
import { parseTwilioInbound } from "./twilio-adapter";
import { parseTelnyxInbound } from "./telnyx-adapter";
import { brDigits, isRamal, toDialE164 } from "./voip-dial";
import { voipSetup } from "./voip-setup";

describe("voip dial helpers", () => {
  it("keeps short ramais and normalizes BR numbers", () => {
    expect(isRamal("1001")).toBe(true);
    expect(isRamal("+5511999998888")).toBe(false);
    expect(toDialE164("11999998888")).toBe("+5511999998888");
    expect(brDigits("+5511999998888")).toBe("11999998888");
  });
});

describe("voipSetup", () => {
  it("maps the four live vendors", () => {
    expect(voipSetup("api4com")?.provider).toBe("api4com");
    expect(voipSetup("zenvia")?.fields.some((f) => f.id === "token")).toBe(true);
    expect(voipSetup("twilio")?.fields.some((f) => f.id === "account_sid")).toBe(true);
    expect(voipSetup("telnyx")?.fields.some((f) => f.id === "app_id")).toBe(true);
    expect(voipSetup("asterisk")).toBeNull();
  });
});

describe("parseTwilioInbound", () => {
  it("reads form-encoded status callbacks", () => {
    const req = new Request("https://grid.test/hook", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "CallStatus=completed&To=%2B5511988887777&CallSid=CA123&CallDuration=12",
    });
    const parsed = parseTwilioInbound(req, "CallStatus=completed&To=%2B5511988887777&CallSid=CA123&CallDuration=12");
    expect(parsed?.disposition).toBe("completed");
    expect(parsed?.e164).toBe("+5511988887777");
    expect(parsed?.externalId).toBe("CA123");
    expect(parsed?.durationSec).toBe(12);
  });
});

describe("parseTelnyxInbound", () => {
  it("ignores answered events and parses hangup with client_state", () => {
    const state = Buffer.from(
      JSON.stringify({ to: "+5511988887777", cnpj: "12345678000190" }),
      "utf8",
    ).toString("base64url");
    expect(
      parseTelnyxInbound(
        JSON.stringify({
          data: { event_type: "call.answered", payload: { client_state: state } },
        }),
      ),
    ).toBeNull();
    const hangup = parseTelnyxInbound(
      JSON.stringify({
        data: {
          event_type: "call.hangup",
          payload: {
            client_state: state,
            hangup_cause: "NORMAL_CLEARING",
            duration_secs: 9,
            call_control_id: "v3:abc",
          },
        },
      }),
    );
    expect(hangup?.cnpj).toBe("12345678000190");
    expect(hangup?.e164).toBe("+5511988887777");
    expect(hangup?.durationSec).toBe(9);
  });
});
