import { afterEach, describe, expect, it } from "vitest";
import {
  clientIp,
  rateLimit,
  resetRateLimitStore,
  takeToken,
} from "./rate-limit";

afterEach(() => {
  resetRateLimitStore();
});

describe("takeToken", () => {
  it("allows up to the limit inside the window", () => {
    const now = 1_000_000;
    expect(takeToken("k", 2, 60_000, now).ok).toBe(true);
    expect(takeToken("k", 2, 60_000, now + 10).ok).toBe(true);
    expect(takeToken("k", 2, 60_000, now + 20).ok).toBe(false);
  });

  it("resets after the window", () => {
    const now = 1_000_000;
    takeToken("k", 1, 1_000, now);
    expect(takeToken("k", 1, 1_000, now + 999).ok).toBe(false);
    expect(takeToken("k", 1, 1_000, now + 1_000).ok).toBe(true);
  });
});

describe("rateLimit", () => {
  it("isolates buckets and IPs", () => {
    const now = 5_000_000;
    for (let i = 0; i < 8; i += 1) {
      expect(rateLimit("1.1.1.1", "auth", now).ok).toBe(true);
    }
    expect(rateLimit("1.1.1.1", "auth", now).ok).toBe(false);
    expect(rateLimit("2.2.2.2", "auth", now).ok).toBe(true);
    expect(rateLimit("1.1.1.1", "read", now).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    const req = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    });
    expect(clientIp(req)).toBe("10.0.0.1");
  });
});
