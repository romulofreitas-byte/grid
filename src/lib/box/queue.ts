import { activitySignal } from "@/lib/crm/activity";
import { firstDialablePhone, uniquePhones } from "@/lib/crm/dial";
import type { ActivitySignal, CrmActivityKind, CrmOutcome } from "@/lib/crm/types";
import type { BoxRhythm } from "@/lib/box/rhythm";

export const BOX_QUEUE_KINDS = ["ligar", "whatsapp"] as const;
export type BoxQueueKind = (typeof BOX_QUEUE_KINDS)[number];

export const BOX_QUEUE_BUCKETS = ["overdue", "followup", "cold"] as const;
export type BoxQueueBucket = (typeof BOX_QUEUE_BUCKETS)[number];

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
  kind: BoxQueueKind;
  dueAt: string;
  bucket: BoxQueueBucket;
  signal: Exclude<ActivitySignal, "none">;
};

export type BoxQueue = {
  overdue: BoxQueueItem[];
  followup: BoxQueueItem[];
  cold: BoxQueueItem[];
};

export type BoxQueueCounts = {
  overdue: number;
  followup: number;
  cold: number;
  total: number;
};

export type BoxQueuePayload = {
  crmAllowed: boolean;
  trialExpired: boolean;
  overdue: BoxQueueItem[];
  followup: BoxQueueItem[];
  cold: BoxQueueItem[];
  counts: BoxQueueCounts;
  rhythm: BoxRhythm;
};

const BUCKET_RANK: Record<BoxQueueBucket, number> = {
  overdue: 0,
  followup: 1,
  cold: 2,
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

export function boxQueueBucket(
  source: Pick<BoxQueueSource, "dueAt" | "status" | "canonicalKey">,
  now: Date = new Date(),
): BoxQueueBucket | null {
  const signal = activitySignal(
    { due_at: source.dueAt, status: source.status },
    now,
  );
  if (signal === "none") return null;
  if (signal === "overdue") return "overdue";
  if (isColdProspectingStage(source.canonicalKey)) return "cold";
  return "followup";
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
      kind: source.kind,
      dueAt: source.dueAt,
      bucket,
      signal,
    });
  }
  items.sort(compareBoxQueueItems);
  return {
    overdue: items.filter((item) => item.bucket === "overdue"),
    followup: items.filter((item) => item.bucket === "followup"),
    cold: items.filter((item) => item.bucket === "cold"),
  };
}

export function flattenBoxQueue(queue: BoxQueue): BoxQueueItem[] {
  return [...queue.overdue, ...queue.followup, ...queue.cold];
}

export function boxQueueCounts(queue: BoxQueue): BoxQueueCounts {
  return {
    overdue: queue.overdue.length,
    followup: queue.followup.length,
    cold: queue.cold.length,
    total: queue.overdue.length + queue.followup.length + queue.cold.length,
  };
}

export function nextBoxQueueKind(kind: CrmActivityKind | BoxQueueKind): BoxQueueKind {
  return kind === "whatsapp" ? "whatsapp" : "ligar";
}
