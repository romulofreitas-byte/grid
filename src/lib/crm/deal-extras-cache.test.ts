import { describe, expect, it } from "vitest";
import type { CrmBriefing } from "@/lib/crm/briefing";
import {
  clearCachedDealBriefing,
  getCachedDealBriefing,
  getCachedDealEvents,
  loadDealBriefing,
  loadDealEvents,
  setCachedDealBriefing,
  setCachedDealEvents,
} from "./deal-extras-cache";
import type { CrmEvent } from "./types";

const event: CrmEvent = {
  id: "e1",
  deal_id: "d1",
  kind: "ligar",
  body: "Ligou",
  meta: {},
  created_at: "2026-09-01T12:00:00.000Z",
  updated_at: "2026-09-01T12:00:00.000Z",
};

const briefing: CrmBriefing = {
  company: "Padaria",
  phone: null,
  phones: [],
  contact: null,
  municipio: "Uberlândia",
  badges: [],
  audited: false,
};

describe("deal extras cache", () => {
  it("remembers events and briefing per deal", () => {
    expect(getCachedDealEvents("d1")).toBeUndefined();
    setCachedDealEvents("d1", [event]);
    expect(getCachedDealEvents("d1")).toEqual([event]);
    setCachedDealBriefing("d1", briefing);
    expect(getCachedDealBriefing("d1")?.municipio).toBe("Uberlândia");
  });

  it("dedupes in-flight event fetches", async () => {
    let starts = 0;
    const first = loadDealEvents("d2", async () => {
      starts += 1;
      return [event];
    });
    const second = loadDealEvents("d2", async () => {
      starts += 1;
      return [];
    });
    const [a, b] = await Promise.all([first, second]);
    expect(starts).toBe(1);
    expect(a).toEqual([event]);
    expect(b).toEqual([event]);
    expect(getCachedDealEvents("d2")).toEqual([event]);
  });

  it("does not let a cleared briefing fetch overwrite a later result", async () => {
    let release: () => void = () => undefined;
    const stalled = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = loadDealBriefing("d-stale", async () => {
      await stalled;
      return { ...briefing, municipio: "Stale" };
    });
    clearCachedDealBriefing("d-stale");
    setCachedDealBriefing("d-stale", { ...briefing, municipio: "Fresh", audited: true });
    release();
    await pending;
    expect(getCachedDealBriefing("d-stale")?.municipio).toBe("Fresh");
    expect(getCachedDealBriefing("d-stale")?.audited).toBe(true);
  });
});
