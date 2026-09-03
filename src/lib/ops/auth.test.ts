import { afterEach, describe, expect, it, vi } from "vitest";
import {
  credentialsMatch,
  DEFAULT_OPS_EMAIL,
  OPS_COOKIE,
  OPS_SESSION_MS,
  opsCredentialsConfigured,
  opsEmail,
  readOpsCookieFromHeader,
  signOpsToken,
  verifyOpsToken,
} from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ops auth", () => {
  it("is off without a password", () => {
    vi.stubEnv("GRID_OPS_PASSWORD", "");
    vi.stubEnv("GRID_OPS_SECRET", "");
    expect(opsCredentialsConfigured()).toBe(false);
    expect(credentialsMatch(DEFAULT_OPS_EMAIL, "x")).toBe(false);
  });

  it("defaults the email and matches credentials", () => {
    vi.stubEnv("GRID_OPS_PASSWORD", "s3nha-ops");
    vi.stubEnv("GRID_OPS_SECRET", "signing-secret");
    expect(opsEmail()).toBe(DEFAULT_OPS_EMAIL);
    expect(credentialsMatch("Administracao@Combustivelmv.com", "s3nha-ops")).toBe(
      true,
    );
    expect(credentialsMatch("other@x.com", "s3nha-ops")).toBe(false);
    expect(credentialsMatch(DEFAULT_OPS_EMAIL, "wrong")).toBe(false);
  });

  it("signs a cookie that expires after 12h", () => {
    vi.stubEnv("GRID_OPS_PASSWORD", "s3nha-ops");
    vi.stubEnv("GRID_OPS_SECRET", "signing-secret");
    const now = Date.parse("2026-09-03T12:00:00.000Z");
    const token = signOpsToken(now);
    expect(verifyOpsToken(token, now)).toBe(true);
    expect(verifyOpsToken(token, now + OPS_SESSION_MS - 1)).toBe(true);
    expect(verifyOpsToken(token, now + OPS_SESSION_MS + 1)).toBe(false);
    expect(verifyOpsToken("nope", now)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    vi.stubEnv("GRID_OPS_PASSWORD", "s3nha-ops");
    vi.stubEnv("GRID_OPS_SECRET", "one");
    const token = signOpsToken();
    vi.stubEnv("GRID_OPS_SECRET", "two");
    expect(verifyOpsToken(token)).toBe(false);
  });

  it("reads the ops cookie from a header", () => {
    expect(
      readOpsCookieFromHeader(`other=1; ${OPS_COOKIE}=abc.def; x=2`),
    ).toBe("abc.def");
    expect(readOpsCookieFromHeader("other=1")).toBeNull();
  });
});
