"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BoxFocusCard } from "@/components/box/BoxFocusCard";
import { BoxRhythmStrip } from "@/components/box/BoxRhythmStrip";
import { BoxTaskList } from "@/components/box/BoxTaskList";
import type { BoxSlot } from "@/lib/box-estrutura";
import type { BoxQueueBucket, BoxQueuePayload } from "@/lib/box/queue";
import { gridHref, largadaNovaHref } from "@/lib/back";
import { planosHref } from "@/lib/billing/href";
import { COPY } from "@/lib/copy";
import type {
  IntegrationConnectionPublic,
  IntegrationJobRecord,
} from "@/lib/integrations/records";
import {
  BOX_QUEUE_QUERY_KEY,
  invalidateLiveStats,
  LIVE_STATS_QUERY_OPTIONS,
  originateCallJobsActive,
  originateCallJobsPollInterval,
} from "@/lib/live-stats";
import { cn } from "@/lib/utils";

const TABS: Array<{
  id: BoxQueueBucket;
  label: string;
  empty: string;
  alert?: boolean;
}> = [
  { id: "overdue", label: COPY.boxOverdue, empty: COPY.boxTabEmptyOverdue, alert: true },
  { id: "followup", label: COPY.boxFollowup, empty: COPY.boxTabEmptyFollowup },
  { id: "cold", label: COPY.boxCold, empty: COPY.boxTabEmptyCold },
];

function pickTab(queue: BoxQueuePayload): BoxQueueBucket {
  if (queue.counts.overdue > 0) return "overdue";
  if (queue.counts.followup > 0) return "followup";
  if (queue.counts.cold > 0) return "cold";
  return "overdue";
}

export function BoxSprint({
  queue: initialQueue,
  connections,
  novoSearchId,
  gap,
}: {
  queue: BoxQueuePayload;
  connections: IntegrationConnectionPublic[];
  novoSearchId: string | null;
  gap: BoxSlot | null;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const queueQuery = useQuery({
    queryKey: BOX_QUEUE_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/box/queue");
      const body = (await res.json()) as BoxQueuePayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível atualizar a fila");
      return body as BoxQueuePayload;
    },
    initialData: initialQueue,
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const jobsQuery = useQuery({
    queryKey: ["integration-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/jobs");
      return (await res.json()) as { jobs: IntegrationJobRecord[] };
    },
    refetchInterval: (q) =>
      originateCallJobsPollInterval(q.state.data?.jobs ?? []),
  });
  const hadOriginateJob = useRef(false);
  const [tab, setTab] = useState<BoxQueueBucket>(() => pickTab(initialQueue));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const queue = queueQuery.data ?? initialQueue;
  const rows = queue[tab];
  const tabMeta = TABS.find((item) => item.id === tab) ?? TABS[0]!;
  const focus = rows.find((row) => row.id === focusId) ?? rows[0] ?? null;
  const rest = rows.filter((row) => row.id !== focus?.id);

  useEffect(() => {
    const jobs = jobsQuery.data?.jobs ?? [];
    const active = originateCallJobsActive(jobs);
    if (active) {
      hadOriginateJob.current = true;
      return;
    }
    if (!hadOriginateJob.current) return;
    hadOriginateJob.current = false;
    void invalidateLiveStats(qc);
  }, [jobsQuery.data, qc]);

  async function reloadAfter(id: string) {
    setBusyId(id);
    try {
      await invalidateLiveStats(qc);
      await queueQuery.refetch();
      router.refresh();
      setFocusId(null);
    } finally {
      setBusyId(null);
    }
  }

  function selectTab(next: BoxQueueBucket) {
    setTab(next);
    setFocusId(null);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      {gap ? (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5">
          <p className="min-w-0 truncate text-xs text-podium-muted">
            <span className="font-medium text-podium-white">{gap.title}</span>
            <span className="hidden sm:inline"> — {gap.body}</span>
          </p>
          <Link
            href={gap.href}
            className="shrink-0 text-xs text-podium-yellow hover:underline"
          >
            {gap.cta}
          </Link>
        </div>
      ) : null}

      <BoxRhythmStrip rhythm={queue.rhythm} overdueCount={queue.counts.overdue} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5 md:flex-wrap md:justify-end md:px-3 md:py-2">
          <p className="hidden shrink-0 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted md:block">
            {COPY.boxNow}
          </p>
          <div className="flex min-w-0 flex-1 gap-1 md:flex-none md:justify-end">
            {TABS.map((item) => {
              const count = queue.counts[item.id];
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-md px-2.5 text-xs font-medium md:min-h-0 md:px-2 md:py-0.5 md:text-[11px]",
                    active && item.alert && count > 0
                      ? "bg-podium-alert/10 text-podium-alert"
                      : active
                        ? "bg-podium-yellow/10 text-podium-yellow"
                        : "text-podium-muted hover:text-podium-white",
                  )}
                >
                  {item.label}{" "}
                  <span className="tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {queue.counts.total === 0 ? (
            <BoxEmpty crmAllowed={queue.crmAllowed} novoSearchId={novoSearchId} />
          ) : focus ? (
            <>
              <BoxFocusCard
                key={focus.id}
                item={focus}
                connections={connections}
                busy={busyId === focus.id}
                onCalled={() => {
                  void invalidateLiveStats(qc);
                }}
                onDone={() => reloadAfter(focus.id)}
              />
              {rest.length > 0 ? (
                <div className="flex min-h-0 flex-col">
                  <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted">
                    {COPY.boxQueue}
                  </p>
                  <BoxTaskList
                    rows={rest}
                    empty={tabMeta.empty}
                    connections={connections}
                    onFocus={setFocusId}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <BoxTaskList
              rows={rest}
              empty={tabMeta.empty}
              connections={connections}
              onFocus={setFocusId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BoxEmpty({
  crmAllowed,
  novoSearchId,
}: {
  crmAllowed: boolean;
  novoSearchId: string | null;
}) {
  const quietCta =
    "inline-flex rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-podium-gray hover:border-podium-yellow/35 hover:text-podium-white";

  if (!crmAllowed) {
    return (
      <div className="px-4 py-8">
        <p className="max-w-lg text-pretty text-sm text-podium-muted">
          {COPY.boxSprintLocked}
        </p>
        <Link href={planosHref("/box")} className={cn(quietCta, "mt-4")}>
          Ver planos
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <p className="max-w-lg text-pretty text-sm text-podium-muted">
        {COPY.boxSprintEmpty}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {novoSearchId ? (
          <Link href={gridHref(novoSearchId, "box")} className={quietCta}>
            {COPY.boxSprintEmptyNovo}
          </Link>
        ) : (
          <Link href={largadaNovaHref} className={quietCta}>
            {COPY.novaLista}
          </Link>
        )}
        <Link href="/crm" className={quietCta}>
          {COPY.boxSprintEmptyCrm}
        </Link>
      </div>
    </div>
  );
}
