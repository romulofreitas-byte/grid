import { describe, expect, it } from "vitest";
import { countCacheKey } from "./count-cache";
import { DEFAULT_FILTERS } from "@/lib/types";

describe("countCacheKey", () => {
  it("is stable for the same filters and mode", () => {
    const allowed = new Set(["5611201", "5611203"]);
    const a = countCacheKey(DEFAULT_FILTERS, "full", allowed);
    const b = countCacheKey(DEFAULT_FILTERS, "full", allowed);
    expect(a).toBe(b);
    expect(a.startsWith("count:v1:")).toBe(true);
  });

  it("changes when mode or filters differ", () => {
    const allowed = new Set(["5611201"]);
    const full = countCacheKey(DEFAULT_FILTERS, "full", allowed);
    const total = countCacheKey(DEFAULT_FILTERS, "total", allowed);
    const matriz = countCacheKey(
      { ...DEFAULT_FILTERS, soMatriz: true },
      "full",
      allowed,
    );
    expect(full).not.toBe(total);
    expect(full).not.toBe(matriz);
  });
});
