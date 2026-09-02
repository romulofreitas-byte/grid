import { describe, expect, it } from "vitest";
import {
  cachedCandidateCnpjs,
  countCacheKey,
  countResultForClient,
} from "./count-cache";
import { SEARCH_CANDIDATE_CAP } from "@/lib/data/establishments-search-sql";
import { DEFAULT_FILTERS, type CountResult } from "@/lib/types";

describe("countCacheKey", () => {
  it("is stable for the same filters and mode", () => {
    const allowed = new Set(["5611201", "5611203"]);
    const a = countCacheKey(DEFAULT_FILTERS, "full", allowed);
    const b = countCacheKey(DEFAULT_FILTERS, "full", allowed);
    expect(a).toBe(b);
    expect(a.startsWith("count:v2:")).toBe(true);
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

function count(over: Partial<CountResult> = {}): CountResult {
  return {
    total: 2,
    capped: false,
    comTelefone: 2,
    comEmail: 1,
    comDecisor: 1,
    porMunicipio: [],
    cnpjs: ["12345678000190", "12345678000191"],
    ...over,
  };
}

describe("cachedCandidateCnpjs", () => {
  it("returns CNPJs when the full count is within the cap", () => {
    expect(cachedCandidateCnpjs(count(), SEARCH_CANDIDATE_CAP)).toEqual([
      "12345678000190",
      "12345678000191",
    ]);
  });

  it("skips capped or oversized counts", () => {
    expect(
      cachedCandidateCnpjs(count({ capped: true }), SEARCH_CANDIDATE_CAP),
    ).toBeNull();
    expect(
      cachedCandidateCnpjs(
        count({ total: SEARCH_CANDIDATE_CAP + 1 }),
        SEARCH_CANDIDATE_CAP,
      ),
    ).toBeNull();
    expect(
      cachedCandidateCnpjs(count({ total: 3 }), SEARCH_CANDIDATE_CAP),
    ).toBeNull();
    expect(
      cachedCandidateCnpjs(count({ cnpjs: undefined }), SEARCH_CANDIDATE_CAP),
    ).toBeNull();
  });
});

describe("countResultForClient", () => {
  it("strips CNPJs before the count API responds", () => {
    const publicResult = countResultForClient(count());
    expect(publicResult.cnpjs).toBeUndefined();
    expect(publicResult.total).toBe(2);
  });
});
