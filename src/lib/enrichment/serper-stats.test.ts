import { describe, expect, it } from "vitest";
import {
  domainDensityVerdict,
  gmbDensityVerdict,
  instagramDensityVerdict,
  summarizeSerperDensity,
  withSerperStage,
  withSerperStats,
  noteDomainWave,
  recordSerperCall,
  serperStatsSnapshot,
  type SerperCallRecord,
} from "./serper-stats";

function call(
  partial: Partial<SerperCallRecord> &
    Pick<SerperCallRecord, "kind" | "stage">,
): SerperCallRecord {
  return {
    ok: true,
    hits: 1,
    ms: 10,
    ...partial,
  };
}

describe("domainDensityVerdict", () => {
  it("marks fallback or Maps rescue as dense", () => {
    expect(
      domainDensityVerdict({
        status: "nao_confirmado",
        wave: "fallback",
        searchCalls: 5,
      }),
    ).toBe("dense");
    expect(
      domainDensityVerdict({
        status: "confirmado",
        wave: "gmb",
        searchCalls: 2,
      }),
    ).toBe("dense");
  });

  it("marks a full-budget miss as exhausted, not thin", () => {
    expect(
      domainDensityVerdict({
        status: "nao_encontrado",
        wave: null,
        searchCalls: 7,
      }),
    ).toBe("exhausted");
  });

  it("marks no Google calls as skipped", () => {
    expect(
      domainDensityVerdict({
        status: "nao_encontrado",
        wave: null,
        searchCalls: 0,
      }),
    ).toBe("skipped");
  });
});

describe("gmbDensityVerdict", () => {
  it("treats a first-query match as early and later queries as dense", () => {
    expect(
      gmbDensityVerdict({
        listing: { name: "Solaris", url: "https://maps.google.com/?cid=1", matched: true },
        mapsCalls: 1,
        retryOrSiteCalls: 0,
      }),
    ).toBe("early");
    expect(
      gmbDensityVerdict({
        listing: { name: "Solaris", url: "https://maps.google.com/?cid=1", matched: true },
        mapsCalls: 4,
        retryOrSiteCalls: 0,
      }),
    ).toBe("dense");
  });

  it("keeps an unmatched city pin as candidate", () => {
    expect(
      gmbDensityVerdict({
        listing: {
          name: "Solaris",
          url: "https://www.google.com/maps?cid=2",
          matched: false,
          status: "candidate",
        },
        mapsCalls: 6,
        retryOrSiteCalls: 0,
      }),
    ).toBe("candidate");
  });

  it("marks a Maps miss after queries as exhausted", () => {
    expect(
      gmbDensityVerdict({
        listing: { name: "", url: "", matched: false, status: "none" },
        mapsCalls: 8,
        retryOrSiteCalls: 0,
      }),
    ).toBe("exhausted");
  });
});

describe("instagramDensityVerdict", () => {
  it("separates a later-query hit from a miss after the budget", () => {
    expect(
      instagramDensityVerdict({
        url: "https://instagram.com/solaris",
        fonte: "serper",
        searchCalls: 3,
      }),
    ).toBe("dense");
    expect(
      instagramDensityVerdict({
        url: undefined,
        fonte: "serper_miss",
        searchCalls: 4,
      }),
    ).toBe("exhausted");
    expect(
      instagramDensityVerdict({
        url: undefined,
        fonte: "serper_miss",
        searchCalls: 0,
      }),
    ).toBe("skipped");
  });
});

describe("summarizeSerperDensity", () => {
  it("counts stages and classifies a dense domain rescue", () => {
    const summary = summarizeSerperDensity({
      calls: [
        call({ kind: "search", stage: "domain" }),
        call({ kind: "search", stage: "domain" }),
        call({ kind: "search", stage: "domain_fallback" }),
        call({ kind: "maps", stage: "gmb", hits: 3 }),
        call({ kind: "maps", stage: "gmb", hits: 0 }),
        call({ kind: "search", stage: "instagram", hits: 0 }),
      ],
      domainWave: "fallback",
      domainStatus: "confirmado",
      gmb: { name: "Solaris", url: "https://maps.google.com/?cid=1", matched: true },
      instagramUrl: undefined,
      instagramFonte: "serper_miss",
    });
    expect(summary.calls).toBe(6);
    expect(summary.search).toBe(4);
    expect(summary.maps).toBe(2);
    expect(summary.domain).toBe("dense");
    expect(summary.gmb).toBe("dense");
    expect(summary.instagram).toBe("exhausted");
    expect(summary.by_stage.domain).toBe(2);
    expect(summary.by_stage.domain_fallback).toBe(1);
  });
});

describe("withSerperStage", () => {
  it("attributes parallel stages without mixing the call list", async () => {
    await withSerperStats(async () => {
      await Promise.all([
        withSerperStage("domain", async () => {
          recordSerperCall({ kind: "search", ok: true, hits: 2, ms: 5 });
        }),
        withSerperStage("gmb", async () => {
          recordSerperCall({ kind: "maps", ok: true, hits: 1, ms: 8 });
        }),
      ]);
      noteDomainWave("primary");
      const snap = serperStatsSnapshot();
      expect(snap.domainWave).toBe("primary");
      expect(snap.calls.map((c) => `${c.stage}:${c.kind}`).sort()).toEqual([
        "domain:search",
        "gmb:maps",
      ]);
    });
  });
});
