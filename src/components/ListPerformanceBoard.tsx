"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChartDonut } from "@/components/charts/Charts";
import { CHART } from "@/components/charts/chartTheme";
import { COPY } from "@/lib/copy";
import { gridHref } from "@/lib/back";
import {
  LIST_SLICES,
  LIST_SLICE_FILL,
  pctOf,
  type ListPerformance,
  type ListRecorte,
  type ListSliceId,
} from "@/lib/listas/performance";
import { listVerdict, type ListVerdictKind } from "@/lib/listas/verdict";
import { cn } from "@/lib/utils";

const SLICE_LABEL: Record<ListSliceId, string> = {
  parados: COPY.listasSliceParados,
  em_acao: COPY.listasSliceEmAcao,
  ganhos: COPY.listasSliceGanhos,
  perdidos: COPY.listasSlicePerdidos,
};

const VERDICT_COPY: Record<ListVerdictKind, string> = {
  idle: COPY.listasVerdictIdle,
  qualified_no_calls: COPY.listasVerdictQualifiedNoCalls,
  has_win: COPY.listasVerdictHasWin,
  has_win_elsewhere: COPY.listasVerdictHasWinElsewhere,
  high_discard: COPY.listasVerdictHighDiscard,
  in_progress: COPY.listasVerdictInProgress,
};

export function ListHealthBar({
  stats,
  className,
}: {
  stats: ListPerformance;
  className?: string;
}) {
  const total = stats.total;
  return (
    <span
      className={cn(
        "flex h-1.5 w-10 overflow-hidden rounded-full bg-white/10",
        className,
      )}
      aria-hidden
    >
      {total <= 0
        ? null
        : LIST_SLICES.map((id) => {
            const value = stats[id];
            if (value <= 0) return null;
            return (
              <span
                key={id}
                className="h-full"
                style={{
                  width: `${(value / total) * 100}%`,
                  backgroundColor: LIST_SLICE_FILL[id],
                }}
              />
            );
          })}
    </span>
  );
}

export function ListPerformanceBoard({
  searchId,
  stats,
  otherHasWin,
}: {
  searchId: string;
  stats: ListPerformance;
  otherHasWin?: boolean;
}) {
  const router = useRouter();
  const performance = stats;
  const donut = LIST_SLICES.map((id) => ({
    id,
    name: SLICE_LABEL[id],
    value: performance[id],
    fill: LIST_SLICE_FILL[id],
  }));
  const kind = listVerdict(performance, { otherHasWin });
  const kpis: Array<{
    recorte: ListRecorte;
    label: string;
    value: number;
    fill: string;
  }> = [
    {
      recorte: "qualificadas",
      label: COPY.listasKpiQualificadas,
      value: performance.qualified,
      fill: CHART.enrich,
    },
    {
      recorte: "ligacoes",
      label: COPY.listasKpiLigacoes,
      value: performance.called,
      fill: CHART.calls,
    },
    {
      recorte: "ganhos",
      label: COPY.listasSliceGanhos,
      value: performance.ganhos,
      fill: CHART.won,
    },
    {
      recorte: "perdidos",
      label: COPY.listasSlicePerdidos,
      value: performance.perdidos,
      fill: CHART.lost,
    },
  ];

  function openRecorte(recorte: ListRecorte) {
    router.push(gridHref(searchId, "listas", { recorte }));
  }

  return (
    <div className="mt-4 space-y-3">
      <ChartDonut
        data={donut}
        onSlice={(id) => openRecorte(id as ListSliceId)}
      />
      <div className="grid grid-cols-2 gap-2">
        {kpis.map((kpi) => (
          <Link
            key={kpi.recorte}
            href={gridHref(searchId, "listas", { recorte: kpi.recorte })}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: kpi.fill }}
              />
              {kpi.label}
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tabular-nums text-podium-white">
                {kpi.value.toLocaleString("pt-BR")}
              </span>
              <span className="text-[11px] tabular-nums text-podium-muted">
                {pctOf(kpi.value, performance.total)}%
              </span>
            </p>
          </Link>
        ))}
      </div>
      <p
        className={cn(
          "rounded-lg border px-2.5 py-2 text-[12px] leading-snug",
          kind === "has_win" && "border-emerald-400/35 bg-emerald-400/10 text-emerald-100",
          kind === "has_win_elsewhere" &&
            "border-sky-400/35 bg-sky-400/10 text-sky-100",
          kind === "high_discard" && "border-red-400/35 bg-red-400/10 text-red-100",
          kind === "idle" && "border-white/10 bg-white/[0.03] text-podium-gray",
          kind === "qualified_no_calls" &&
            "border-podium-yellow/30 bg-podium-yellow/10 text-podium-white",
          kind === "in_progress" &&
            "border-pink-400/30 bg-pink-400/10 text-podium-white",
        )}
      >
        {VERDICT_COPY[kind]}
      </p>
    </div>
  );
}
