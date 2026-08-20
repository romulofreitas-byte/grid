"use client";

import { GlassCard } from "@/components/GlassCard";
import { FichaChip } from "@/components/FichaChip";
import {
  MES_CURTO,
  mesNumero,
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

function firstName(nome: string | null | undefined): string {
  const first = nome?.trim().split(/\s+/)[0];
  return first || "—";
}

function Cue({
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
  children?: string | null;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2.5 text-left",
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
              "rounded-xl px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
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
          "mt-1 text-xs font-extrabold leading-snug",
          live ? "text-podium-yellow" : "text-podium-white",
        )}
      >
        {title}
      </p>
      {children ? (
        <p className="mt-0.5 text-[11px] leading-snug text-podium-muted">
          {children}
        </p>
      ) : null}
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
      <ol className="flex flex-wrap gap-1">
        {MES_CURTO.map((label, index) => {
          const month = index + 1;
          const inSeason = peaks.includes(month);
          const isNow = month === current;
          return (
            <li key={month}>
              <span
                className={cn(
                  "inline-flex h-6 min-w-[1.85rem] items-center justify-center rounded-md px-1.5 text-[10px] font-bold",
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
        <p className="mt-1.5 text-[11px] leading-relaxed text-podium-muted">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function AnatomyCard({
  market,
  uf,
  decisorNome,
  volta,
  now = new Date(),
}: {
  market: MarketBrief;
  uf?: string | null;
  decisorNome?: string | null;
  volta?: string | null;
  now?: Date;
}) {
  const status = seasonStatus(market.sazonalidadeMeses, now);
  const place = [market.cidade, uf].filter(Boolean).join(" · ");
  const seasonTitle =
    status === "nenhuma"
      ? "Sem pico"
      : (market.sazonalidadeChip ?? "Janela");
  const seasonHook =
    market.sazonalidadeAtiva && market.sazonalidade?.trim()
      ? market.sazonalidade.trim()
      : null;
  const tip = [market.dorPrincipal.trim(), seasonHook]
    .filter(Boolean)
    .join(" ");
  const angulo = market.perguntaConsideracao.trim();

  return (
    <GlassCard className="relative overflow-hidden p-5 hover:translate-y-0" highlight>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 top-0 h-56 w-56 bg-[radial-gradient(circle,rgba(245,179,1,0.10),transparent_65%)]"
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
              Anatomia
            </p>
            <h2 className="mt-1 text-lg font-extrabold leading-tight text-podium-yellow">
              {market.dorChip}
            </h2>
            <p className="mt-1 truncate text-xs capitalize text-podium-gray">
              {market.nome}
              {place ? ` · ${place}` : ""}
            </p>
          </div>
          {volta ? (
            <FichaChip as="span" active className="shrink-0">
              {volta}
            </FichaChip>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Cue kicker="Quem" title={firstName(decisorNome)} />
          <Cue
            kicker="Calendário"
            title={seasonTitle}
            live={status === "agora"}
            pill={SEASON_PILL[status]}
          />
          <Cue kicker="Ligar" title={market.janelaChip}>
            {place || null}
          </Cue>
        </div>

        {tip ? (
          <p className="mt-4 text-xs leading-relaxed text-podium-gray">{tip}</p>
        ) : null}

        <PeakChips months={market.sazonalidadeMeses} now={now} />

        {angulo ? (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-podium-muted">
              Ângulo
            </p>
            <p className="mt-1 text-xs font-medium leading-snug text-podium-white/80">
              {angulo}
            </p>
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}
