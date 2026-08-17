import { describe, expect, it } from "vitest";
import {
  HMAC_MAX_SKEW_SEC,
  signGridWebhook,
  verifyGridWebhook,
} from "./hmac";

const secret = "test-webhook-secret";
const body = JSON.stringify({ event: "call.outcome", cnpj: "12345678000190" });

describe("signGridWebhook / verifyGridWebhook", () => {
  it("round-trips a signed body", () => {
    const signed = signGridWebhook(secret, body, 1_700_000_000, "call.outcome");
    expect(signed.signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    const result = verifyGridWebhook({
      secret,
      rawBody: body,
      signatureHeader: signed.headers["x-grid-signature"],
      timestampHeader: signed.headers["x-grid-timestamp"],
      nowSec: 1_700_000_000,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a tampered body", () => {
    const signed = signGridWebhook(secret, body, 1_700_000_000);
    const result = verifyGridWebhook({
      secret,
      rawBody: body.replace("1234", "0000"),
      signatureHeader: signed.signature,
      timestampHeader: String(signed.timestamp),
      nowSec: 1_700_000_000,
    });
    expect(result).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects replay outside the skew window", () => {
    const signed = signGridWebhook(secret, body, 1_700_000_000);
    const result = verifyGridWebhook({
      secret,
      rawBody: body,
      signatureHeader: signed.signature,
      timestampHeader: String(signed.timestamp),
      nowSec: 1_700_000_000 + HMAC_MAX_SKEW_SEC + 1,
    });
    expect(result).toEqual({ ok: false, reason: "skew" });
  });

  it("rejects a missing signature", () => {
    const result = verifyGridWebhook({
      secret,
      rawBody: body,
      signatureHeader: null,
      timestampHeader: "1700000000",
      nowSec: 1_700_000_000,
    });
    expect(result).toEqual({ ok: false, reason: "missing" });
  });
});
