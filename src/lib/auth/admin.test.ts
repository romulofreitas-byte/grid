import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminEmail, isAdminSession } from "./admin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAdminEmail", () => {
  it("matches allowlist case-insensitively", () => {
    vi.stubEnv("GRID_ADMIN_EMAILS", "Founder@Example.com, ops@grid.com");
    expect(isAdminEmail("founder@example.com")).toBe(true);
    expect(isAdminEmail("other@test.com")).toBe(false);
  });

  it("denies when allowlist empty", () => {
    vi.stubEnv("GRID_ADMIN_EMAILS", "");
    expect(isAdminEmail("founder@example.com")).toBe(false);
  });
});

describe("isAdminSession", () => {
  it("allows mock dev when allowlist unset", () => {
    vi.stubEnv("GRID_MOCK_AUTH", "1");
    vi.stubEnv("GRID_ADMIN_EMAILS", "");
    expect(isAdminSession({ email: "piloto@mundopodium.com.br" })).toBe(true);
  });

  it("respects allowlist in mock mode when set", () => {
    vi.stubEnv("GRID_MOCK_AUTH", "1");
    vi.stubEnv("GRID_ADMIN_EMAILS", "ops@grid.com");
    expect(isAdminSession({ email: "piloto@mundopodium.com.br" })).toBe(false);
    expect(isAdminSession({ email: "ops@grid.com" })).toBe(true);
  });
});
