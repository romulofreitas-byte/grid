import { afterEach, describe, expect, it, vi } from "vitest";
import { usesMockAuth } from "./mock";

describe("usesMockAuth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is on when GRID_MOCK_AUTH=1 even with Supabase keys", () => {
    vi.stubEnv("GRID_MOCK_AUTH", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(usesMockAuth()).toBe(true);
  });

  it("is off when keys exist and mock flag is unset", () => {
    vi.stubEnv("GRID_MOCK_AUTH", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(usesMockAuth()).toBe(false);
  });
});
