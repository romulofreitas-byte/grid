import { saoPauloDay } from "@/lib/call-stats";
import { activitySignal } from "@/lib/crm/activity";
import { firstDialablePhone, uniquePhones } from "@/lib/crm/dial";
import type { ActivitySignal, CrmActivityKind, CrmOutcome } from "@/lib/crm/types";
import type { BoxRhythm } from "@/lib/box/rhythm";

export const BOX_QUEUE_KINDS = ["ligar", "whatsapp"] as const;
export type BoxQueueKind = (typeof BOX_QUEUE_KINDS)[number];

export const BOX_QUEUE_BUCKETS = [
  "overdue",
  "today",
  "tomorrow",
  "week",
  "later",
] as const;
export type BoxQueueBucket = (typeof BOX_QUEUE_BUCKETS)[number];

export const BOX_QUEUE_DEFAULT_TAB = "all";
export type BoxQueueTab = typeof BOX_QUEUE_DEFAULT_TAB | BoxQueueBucket;

export type BoxQueueSource = {
  activityId: string;
  dealId: string;
  pipelineId: string;
  pipelineNome: string;
  companyName: string;
  contactName: string;
  cnpj: string | null;
  searchId: string | null;
  phones: string[];
  stageNome: string;
  canonicalKey: string | null;
  lastNote: string;
  outcome: CrmOutcome;
  kind: string;
  dueAt: string;
  status: "open" | "done";
};

export type BoxQueueItem = {
  id: string;
  dealId: string;
  pipelineId: string;
  pipelineNome: string;
  companyName: string;
  contactName: string;
  cnpj: string | null;
  searchId: string | null;
  phone: string | null;
  phones: string[];
  stageNome: string;
  canonicalKey: string | null;
  lastNote: string | null;
  kind: BoxQueueKind;
  dueAt: string;
  bucket: BoxQueueBucket;
  signal: Exclude<ActivitySignal, "none">;
};

export type BoxQueue = Record<BoxQueueBucket, BoxQueueItem[]>;

export type BoxQueueCounts = Record<BoxQueueBucket, number> & {
  total: number;
};

export type BoxQueuePayload = BoxQueue & {
  crmAllowed: boolean;
  trialExpired: boolean;
  counts: BoxQueueCounts;
  rhythm: BoxRhythm;
  openDealCount: number;
  openOtherActivityCount: number;
};

const BUCKET_RANK: Record<BoxQueueBucket, number> = {
  overdue: 0,
  today: 1,
  tomorrow: 2,
  week: 3,
  later: 4,
};

const SIGNAL_RANK: Record<Exclude<ActivitySignal, "none">, number> = {
  overdue: 0,
  today: 1,
  scheduled: 2,
};

export function isBoxQueueKind(kind: string): kind is BoxQueueKind {
  return kind === "ligar" || kind === "whatsapp";
}

/** Cold sprint = still in first outreach, not yet a conversation. */
export function isColdProspectingStage(
  canonicalKey: string | null | undefined,
): boolean {
  return canonicalKey === "entrada" || canonicalKey === "tentando_contato";
}

function shiftSpDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d! + delta, 15);
  return saoPauloDay(new Date(utc));
}

/** 0 = Monday … 6 = Sunday, for a `YYYY-MM-DD` São Paulo civil date. */
function mondayOffset(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const sun0 = new Date(Date.UTC(y!, m! - 1, d!, 15)).getUTCDay();
  return sun0 === 0 ? 6 : sun0 - 1;
}

function sundayOfWeek(day: string): string {
  return shiftSpDay(day, 6 - mondayOffset(day));
}

export function emptyBoxQueue(): BoxQueue {
  return { overdue: [], today: [], tomorrow: [], week: [], later: [] };
}

export function boxQueueBucket(
  source: Pick<BoxQueueSource, "dueAt" | "status">,
  now: Date = new Date(),
): BoxQueueBucket | null {
  const signal = activitySignal(
    { due_at: source.dueAt, status: source.status },
    now,
  );
  if (signal === "none") return null;
  if (signal === "overdue") return "overdue";
  const dueDay = saoPauloDay(source.dueAt);
  const today = saoPauloDay(now);
  if (dueDay === today) return "today";
  const tomorrow = shiftSpDay(today, 1);
  if (dueDay === tomorrow) return "tomorrow";
  if (dueDay <= sundayOfWeek(today)) return "week";
  return "later";
}

export function compareBoxQueueItems(a: BoxQueueItem, b: BoxQueueItem): number {
  const bucket = BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket];
  if (bucket !== 0) return bucket;
  const signal = SIGNAL_RANK[a.signal] - SIGNAL_RANK[b.signal];
  if (signal !== 0) return signal;
  const due = a.dueAt.localeCompare(b.dueAt);
  if (due !== 0) return due;
  return a.companyName.localeCompare(b.companyName, "pt-BR");
}

export function buildBoxQueue(
  sources: readonly BoxQueueSource[],
  now: Date = new Date(),
): BoxQueue {
  const items: BoxQueueItem[] = [];
  for (const source of sources) {
    if (source.outcome !== "open") continue;
    if (source.status !== "open") continue;
    if (!isBoxQueueKind(source.kind)) continue;
    const bucket = boxQueueBucket(source, now);
    if (!bucket) continue;
    const signal = activitySignal(
      { due_at: source.dueAt, status: source.status },
      now,
    );
    if (signal === "none") continue;
    const phones = uniquePhones(source.phones);
    const note = source.lastNote.trim();
    items.push({
      id: source.activityId,
      dealId: source.dealId,
      pipelineId: source.pipelineId,
      pipelineNome: source.pipelineNome,
      companyName: source.companyName,
      contactName: source.contactName,
      cnpj: source.cnpj,
      searchId: source.searchId,
      phone: firstDialablePhone(phones) ?? phones[0] ?? null,
      phones,
      stageNome: source.stageNome,
      canonicalKey: source.canonicalKey,
      lastNote: note || null,
      kind: source.kind,
      dueAt: source.dueAt,
      bucket,
      signal,
    });
  }
  items.sort(compareBoxQueueItems);
  const queue = emptyBoxQueue();
  for (const item of items) {
    queue[item.bucket].push(item);
  }
  return queue;
}

export function flattenBoxQueue(queue: BoxQueue): BoxQueueItem[] {
  return BOX_QUEUE_BUCKETS.flatMap((id) => queue[id]);
}

export function rowsForBoxTab(
  queue: BoxQueue,
  tab: BoxQueueTab,
): BoxQueueItem[] {
  return tab === "all" ? flattenBoxQueue(queue) : queue[tab];
}

export function boxQueueTabCount(
  counts: BoxQueueCounts,
  tab: BoxQueueTab,
): number {
  return tab === "all" ? counts.total : counts[tab];
}

export function boxQueueCounts(queue: BoxQueue): BoxQueueCounts {
  return {
    overdue: queue.overdue.length,
    today: queue.today.length,
    tomorrow: queue.tomorrow.length,
    week: queue.week.length,
    later: queue.later.length,
    total:
      queue.overdue.length +
      queue.today.length +
      queue.tomorrow.length +
      queue.week.length +
      queue.later.length,
  };
}

export function pickBoxQueueTab(): BoxQueueTab {
  return BOX_QUEUE_DEFAULT_TAB;
}

/** Time filters hop back to Fila when empty; Fila itself stays put. */
export function resolveBoxQueueTab(
  tab: BoxQueueTab,
  counts: BoxQueueCounts,
): BoxQueueTab {
  if (tab === "all") return "all";
  if (counts[tab] === 0 && counts.total > 0) return "all";
  return tab;
}

export function boxQueueShowsCrmIdle(
  payload: Pick<
    BoxQueuePayload,
    "counts" | "openDealCount" | "openOtherActivityCount"
  >,
): boolean {
  return (
    payload.counts.total === 0 &&
    ((payload.openDealCount ?? 0) > 0 ||
      (payload.openOtherActivityCount ?? 0) > 0)
  );
}

export function nextBoxQueueKind(kind: CrmActivityKind | BoxQueueKind): BoxQueueKind {
  return kind === "whatsapp" ? "whatsapp" : "ligar";
}
