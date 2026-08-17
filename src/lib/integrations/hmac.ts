import { createHmac, timingSafeEqual } from "node:crypto";

export const GRID_SIGNATURE_HEADER = "x-grid-signature";
export const GRID_TIMESTAMP_HEADER = "x-grid-timestamp";
export const GRID_EVENT_HEADER = "x-grid-event";

/** Replay window for inbound webhooks (seconds). */
export const HMAC_MAX_SKEW_SEC = 300;

export type SignResult = {
  timestamp: number;
  signature: string;
  headers: Record<string, string>;
};

function hmacHex(secret: string, timestamp: number, rawBody: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export function signGridWebhook(
  secret: string,
  rawBody: string,
  timestamp: number = Math.floor(Date.now() / 1000),
  event?: string,
): SignResult {
  const hex = hmacHex(secret, timestamp, rawBody);
  const signature = `sha256=${hex}`;
  const headers: Record<string, string> = {
    [GRID_TIMESTAMP_HEADER]: String(timestamp),
    [GRID_SIGNATURE_HEADER]: signature,
    "content-type": "application/json",
  };
  if (event) headers[GRID_EVENT_HEADER] = event;
  return { timestamp, signature, headers };
}

export function parseSignatureHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  const prefixed = /^sha256=([0-9a-f]{64})$/i.exec(trimmed);
  if (prefixed) return prefixed[1].toLowerCase();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "malformed" | "skew" | "mismatch" };

/**
 * Verify HMAC-SHA256 over `${unixSeconds}.${rawBody}`.
 * Compare in constant time. Reject timestamps older/newer than HMAC_MAX_SKEW_SEC.
 */
export function verifyGridWebhook(input: {
  secret: string;
  rawBody: string;
  signatureHeader: string | null | undefined;
  timestampHeader: string | null | undefined;
  nowSec?: number;
  maxSkewSec?: number;
}): VerifyResult {
  const provided = parseSignatureHeader(input.signatureHeader);
  const timestamp = Number(input.timestampHeader);
  if (!provided || !input.timestampHeader || !Number.isFinite(timestamp)) {
    return { ok: false, reason: input.signatureHeader ? "malformed" : "missing" };
  }

  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const skew = input.maxSkewSec ?? HMAC_MAX_SKEW_SEC;
  if (Math.abs(now - timestamp) > skew) {
    return { ok: false, reason: "skew" };
  }

  const expectedHex = hmacHex(input.secret, timestamp, input.rawBody);
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expectedHex, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}
