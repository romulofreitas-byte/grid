import type { CrmBriefing } from "@/lib/crm/briefing";
import { dedupeInflight } from "@/lib/crm/pipeline-cache";
import type { CrmEvent } from "@/lib/crm/types";

const eventsByDeal = new Map<string, CrmEvent[]>();
const briefingByDeal = new Map<string, CrmBriefing>();
const eventsInflight = new Map<string, Promise<CrmEvent[]>>();
const briefingInflight = new Map<string, Promise<CrmBriefing>>();
const briefingEpoch = new Map<string, number>();

function currentBriefingEpoch(dealId: string): number {
  return briefingEpoch.get(dealId) ?? 0;
}

function bumpBriefingEpoch(dealId: string) {
  briefingEpoch.set(dealId, currentBriefingEpoch(dealId) + 1);
}

export function getCachedDealEvents(dealId: string): CrmEvent[] | undefined {
  return eventsByDeal.get(dealId);
}

export function setCachedDealEvents(dealId: string, events: CrmEvent[]): void {
  eventsByDeal.set(dealId, events);
}

export function getCachedDealBriefing(dealId: string): CrmBriefing | undefined {
  return briefingByDeal.get(dealId);
}

export function setCachedDealBriefing(
  dealId: string,
  briefing: CrmBriefing,
): void {
  briefingByDeal.set(dealId, briefing);
}

export function clearCachedDealBriefing(dealId: string): void {
  bumpBriefingEpoch(dealId);
  briefingByDeal.delete(dealId);
  briefingInflight.delete(dealId);
}

export function loadDealEvents(
  dealId: string,
  fetcher: () => Promise<CrmEvent[]>,
): Promise<CrmEvent[]> {
  const cached = eventsByDeal.get(dealId);
  if (cached) return Promise.resolve(cached);
  return dedupeInflight(eventsInflight, dealId, async () => {
    const events = await fetcher();
    eventsByDeal.set(dealId, events);
    return events;
  });
}

export function loadDealBriefing(
  dealId: string,
  fetcher: () => Promise<CrmBriefing>,
): Promise<CrmBriefing> {
  const cached = briefingByDeal.get(dealId);
  if (cached) return Promise.resolve(cached);
  const epoch = currentBriefingEpoch(dealId);
  return dedupeInflight(briefingInflight, dealId, async () => {
    const briefing = await fetcher();
    if (currentBriefingEpoch(dealId) === epoch) {
      briefingByDeal.set(dealId, briefing);
    }
    return briefing;
  });
}
