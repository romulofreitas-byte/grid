import { describe, expect, it } from "vitest";
import type { CrmBriefing } from "@/lib/crm/briefing";
import {
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
});
