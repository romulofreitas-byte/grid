import { describe, expect, it } from "vitest";
import {
  enrichConcurrency,
  resolveJobScoreProfile,
  runJobPool,
} from "./process-job";
import { DEFAULT_FILTERS } from "@/lib/types";
import type { NichePreset, Search } from "@/lib/types";

function search(filters: Partial<Search["filtros"]>): Search {
  return {
    id: "s1",
    user_id: "u1",
    nome: "teste",
    filtros: { ...DEFAULT_FILTERS, ...filters },
    total_found: 1,
    created_at: "2026-08-16T12:00:00.000Z",
    saved: false,
  };
}

function preset(perfil_score: NichePreset["perfil_score"]): NichePreset {
  return {
    id: "p-b2b",
    slug: "industria",
    nome: "Indústria",
    grupo: "b2b_industria",
    perfil_score,
    parent_id: null,
    keywords: [],
    exclusoes: [],
    name_stems: [],
    curado: true,
    ordem: 1,
    aliases: [],
  };
}

describe("resolveJobScoreProfile", () => {
  it("uses B2B max when the search segment is indústria", async () => {
    const profile = await resolveJobScoreProfile(
      {
        getSearch: async () => search({ segmentIds: ["p-b2b"] }),
        getPreset: async () => preset("b2b_industria"),
      },
      "s1",
    );
    expect(profile).toBe("b2b_industria");
  });

  it("defaults to b2c_local without a search", async () => {
    const profile = await resolveJobScoreProfile(
      {
        getSearch: async () => undefined,
        getPreset: async () => undefined,
      },
      null,
    );
    expect(profile).toBe("b2c_local");
  });
});

describe("enrichConcurrency", () => {
  it("defaults to 8 and clamps invalid values", () => {
    expect(enrichConcurrency(undefined)).toBe(8);
    expect(enrichConcurrency("")).toBe(8);
    expect(enrichConcurrency("0")).toBe(8);
    expect(enrichConcurrency("nope")).toBe(8);
    expect(enrichConcurrency("16")).toBe(16);
    expect(enrichConcurrency("99")).toBe(32);
  });
});

describe("runJobPool", () => {
  it("claims the next job as soon as a slot frees, without waiting for the slow job", async () => {
    let releaseSlow!: () => void;
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    const queue: Array<"slow" | "fast" | "third"> = ["slow", "fast", "third"];
    const order: string[] = [];

    const processed = await runJobPool({
      concurrency: 2,
      claim: async () => queue.shift() ?? null,
      run: async (job) => {
        if (job === "slow") {
          order.push("slow-start");
          await slow;
          order.push("slow-end");
          return;
        }
        order.push(job);
        if (job === "third") releaseSlow();
      },
    });

    expect(processed).toBe(3);
    expect(order).toEqual(["slow-start", "fast", "third", "slow-end"]);
  });
});
