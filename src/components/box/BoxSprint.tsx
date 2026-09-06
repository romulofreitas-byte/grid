"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BoxFocusCard } from "@/components/box/BoxFocusCard";
import { BoxRhythmStrip } from "@/components/box/BoxRhythmStrip";
import { BoxTaskList } from "@/components/box/BoxTaskList";
import type { BoxSlot } from "@/lib/box-estrutura";
import type { BoxQueueBucket, BoxQueuePayload } from "@/lib/box/queue";
import { gridHref, largadaNovaHref } from "@/lib/back";
import { planosHref } from "@/lib/billing/href";
import { COPY } from "@/lib/copy";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
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
  const [queue, setQueue] = useState(initialQueue);
  const [tab, setTab] = useState<BoxQueueBucket>(() => pickTab(initialQueue));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rows = queue[tab];
  const tabMeta = TABS.find((item) => item.id === tab) ?? TABS[0]!;
  const focus = rows.find((row) => row.id === focusId) ?? rows[0] ?? null;
  const rest = rows.filter((row) => row.id !== focus?.id);

  async function reloadQueue() {
    const res = await fetch("/api/box/queue");
    const body = (await res.json()) as BoxQueuePayload & { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Não foi possível atualizar a fila");
    setQueue(body);
    router.refresh();
  }

  async function reloadAfter(id: string) {
    setBusyId(id);
    try {
      await reloadQueue();
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
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-1.5">
          <p className="min-w-0 truncate text-xs text-zinc-600">
            <span className="font-medium text-zinc-800">{gap.title}</span>
            <span className="hidden sm:inline"> — {gap.body}</span>
          </p>
          <Link
            href={gap.href}
            className="shrink-0 text-xs text-amber-700 hover:underline"
          >
            {gap.cta}
          </Link>
        </div>
      ) : null}

      <BoxRhythmStrip rhythm={queue.rhythm} overdueCount={queue.counts.overdue} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
            {COPY.boxNow}
          </p>
          <div className="flex flex-wrap gap-1">
            {TABS.map((item) => {
              const count = queue.counts[item.id];
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium",
                    active && item.alert && count > 0
                      ? "text-red-600"
                      : active
                        ? "text-amber-800"
                        : "text-zinc-400 hover:text-zinc-700",
                  )}
                >
                  {item.label} {count}
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
                onDone={() => reloadAfter(focus.id)}
              />
              {rest.length > 0 ? (
                <div className="flex min-h-0 flex-col">
                  <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
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
    "inline-flex rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:border-amber-400 hover:text-amber-800";

  if (!crmAllowed) {
    return (
      <div className="px-4 py-8">
        <p className="max-w-lg text-pretty text-sm text-zinc-600">
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
      <p className="max-w-lg text-pretty text-sm text-zinc-600">
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
