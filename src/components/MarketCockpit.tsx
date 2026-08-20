"use client";

import type { ReactNode } from "react";
import { GlassCard } from "@/components/GlassCard";
import {
  MES_CURTO,
  mesNumero,
  nomeMes,
  peakCaption,
  peakMonths,
  seasonStatus,
  type SeasonStatus,
} from "@/lib/market/calendar";
import type { MarketBrief } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEASON_PILL: Record<SeasonStatus, string | null> = {
  agora: "neste mês",
  "na-porta": "mês que vem",
  fora: "fora",
  nenhuma: null,
};

function Gauge({
  kicker,
  title,
  live,
  pill,
  children,
}: {
  kicker: string;
  title: string;
  live?: boolean;
  pill?: string | null;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-3 text-left",
        live
          ? "border-podium-yellow/40 bg-podium-yellow/10"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-[0.16em]",
            live ? "text-podium-yellow" : "text-podium-muted",
          )}
        >
          {kicker}
        </span>
        {pill ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
              live
                ? "bg-podium-yellow text-podium-navy"
                : "border border-white/15 text-podium-muted",
            )}
          >
            {pill}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 text-sm font-extrabold leading-snug",
          live ? "text-podium-yellow" : "text-podium-gray",
        )}
      >
        {title}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-podium-muted">{children}</p>
    </div>
  );
}

function PeakChips({
  months,
  now,
}: {
  months: number[];
  now: Date;
}) {
  const current = mesNumero(now);
  const peaks = peakMonths(months);
  if (peaks.length === 0) return null;
  const caption = peakCaption(months, now);
  return (
    <div className="mt-3">
      <ol className="flex flex-wrap gap-1.5">
        {MES_CURTO.map((label, index) => {
          const month = index + 1;
          const inSeason = peaks.includes(month);
          const isNow = month === current;
          return (
            <li key={month}>
              <span
                className={cn(
                  "inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-lg px-2 text-[10px] font-bold",
                  inSeason && isNow && "bg-podium-yellow text-podium-navy",
                  inSeason && !isNow && "bg-podium-yellow/20 text-podium-yellow",
                  !inSeason && isNow && "border border-podium-yellow/40 text-podium-yellow",
                  !inSeason && !isNow && "border border-white/10 text-podium-muted",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      {caption ? (
        <p className="mt-2 text-xs leading-relaxed text-podium-muted">{caption}</p>
      ) : null}
    </div>
  );
}

export function MarketCockpit({
  market,
  uf,
  now = new Date(),
}: {
  market: MarketBrief;
  uf?: string | null;
  now?: Date;
}) {
  const status = seasonStatus(market.sazonalidadeMeses, now);
  const month = nomeMes(mesNumero(now));
  const place = [market.cidade, uf].filter(Boolean).join(" · ");
  const seasonTitle =
    status === "nenhuma"
      ? "Sem pico marcado"
      : (market.sazonalidadeChip ?? "Janela");

  return (
    <GlassCard className="p-5 hover:translate-y-0" highlight>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight">Clareza de mercado</h2>
          <p className="mt-1 truncate text-sm capitalize text-podium-gray">
            {market.nome} · {place}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold capitalize text-podium-yellow">
          {month}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Gauge kicker="Dor" title={market.dorChip} live>
          {market.dorPrincipal}
        </Gauge>
        <Gauge
          kicker="Calendário"
          title={seasonTitle}
          live={status === "agora"}
          pill={SEASON_PILL[status]}
        >
          {market.sazonalidade ??
            "Este ramo não tem um pico de calendário marcado no estudo."}
        </Gauge>
        <Gauge kicker="Ligar" title={market.janelaChip}>
          <span className="block">{place}</span>
          <span className="mt-1 block">{market.janelaHorario}</span>
        </Gauge>
      </div>

      <PeakChips months={market.sazonalidadeMeses} now={now} />

      <p className="mt-4 text-sm font-bold leading-snug text-podium-white">
        {market.perguntaConsideracao}
      </p>
    </GlassCard>
  );
}
