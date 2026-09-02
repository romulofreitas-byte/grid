import type { CrmBriefing } from "@/lib/crm/briefing";
import { dedupeInflight } from "@/lib/crm/pipeline-cache";
import type { CrmEvent } from "@/lib/crm/types";

const eventsByDeal = new Map<string, CrmEvent[]>();
const briefingByDeal = new Map<string, CrmBriefing>();
const eventsInflight = new Map<string, Promise<CrmEvent[]>>();
const briefingInflight = new Map<string, Promise<CrmBriefing>>();

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
  return dedupeInflight(briefingInflight, dealId, async () => {
    const briefing = await fetcher();
    briefingByDeal.set(dealId, briefing);
    return briefing;
  });
}
