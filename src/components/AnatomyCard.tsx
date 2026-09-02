"use client";

import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/GlassCard";
import {
  MES_CURTO,
  MES_NOME,
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
  fora: "fora do pico",
  nenhuma: null,
};

const SEASON_BANNER: Record<
  SeasonStatus,
  { title: string; className: string } | null
> = {
  agora: {
    title: "Janela aberta — pico de demanda deste nicho",
    className: "border-podium-yellow/40 bg-podium-yellow/10 text-podium-yellow",
  },
  "na-porta": {
    title: "Pico na porta — prepare abordagem este mês",
    className: "border-podium-info/35 bg-podium-info/10 text-podium-info",
  },
  fora: {
    title: "Fora do pico — use ângulo de calendário com cuidado",
    className: "border-white/10 bg-white/[0.03] text-podium-muted",
  },
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
        "rounded-md border px-3 py-2 text-left",
        live
          ? "border-podium-yellow/40 bg-podium-yellow/10"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[9px] font-medium uppercase tracking-[0.12em]",
            live ? "text-podium-yellow" : "text-podium-muted",
          )}
        >
          {kicker}
        </span>
        {pill ? (
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide",
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
          "mt-1 text-xs font-semibold leading-snug",
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

function SeasonCalendar({
  months,
  now,
  sazonalidade,
}: {
  months: number[];
  now: Date;
  sazonalidade: string | null;
}) {
  const current = mesNumero(now);
  const peaks = peakMonths(months);
  const status = seasonStatus(months, now);
  const caption = peakCaption(months, now);
  const banner = SEASON_BANNER[status];

  if (peaks.length === 0 && !sazonalidade?.trim()) {
    return (
      <p className="mt-3 text-sm text-podium-muted">
        Sem calendário de pico curado para este nicho.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted">
            Calendário de mercado
          </p>
          <p className="mt-1 text-sm font-semibold text-podium-white">
            Picos e janelas de oportunidade
          </p>
        </div>
        {SEASON_PILL[status] ? (
          <Badge variant={status === "agora" ? "accent" : "neutral"}>
            {SEASON_PILL[status]}
          </Badge>
        ) : null}
      </div>

      {banner ? (
        <p
          className={cn(
            "mt-3 rounded-md border px-3 py-2 text-xs font-medium leading-snug",
            banner.className,
          )}
        >
          {banner.title}
        </p>
      ) : null}

      {peaks.length > 0 ? (
        <ol className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-12">
          {MES_CURTO.map((label, index) => {
            const month = index + 1;
            const inSeason = peaks.includes(month);
            const isNow = month === current;
            return (
              <li key={month}>
                <span
                  title={MES_NOME[index]}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center",
                    inSeason &&
                      isNow &&
                      "border-podium-yellow bg-podium-yellow text-podium-navy",
                    inSeason &&
                      !isNow &&
                      "border-podium-yellow/35 bg-podium-yellow/15 text-podium-yellow",
                    !inSeason &&
                      isNow &&
                      "border-podium-yellow/40 text-podium-yellow",
                    !inSeason &&
                      !isNow &&
                      "border-white/10 text-podium-muted",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase">
                    {label}
                  </span>
                  {inSeason ? (
                    <span className="mt-0.5 text-[8px] font-semibold uppercase opacity-80">
                      pico
                    </span>
                  ) : isNow ? (
                    <span className="mt-0.5 text-[8px] font-semibold uppercase opacity-70">
                      agora
                    </span>
                  ) : (
                    <span className="mt-0.5 text-[8px] opacity-0">·</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {caption ? (
        <p className="mt-2 text-[11px] leading-relaxed text-podium-gray">
          {caption}
        </p>
      ) : null}

      {sazonalidade?.trim() ? (
        <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
            Contexto do nicho
          </p>
          <p className="mt-1 text-xs leading-relaxed text-podium-gray">
            {sazonalidade.trim()}
          </p>
        </div>
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
      ? "Sem pico curado"
      : (market.sazonalidadeChip ?? "Janela");
  const tip = market.dorPrincipal.trim();
  const angulo = market.perguntaConsideracao.trim();

  return (
    <GlassCard className="relative overflow-hidden border-white/10 bg-white/[0.03] p-5 hover:translate-y-0">
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
              Mercado
            </p>
            <h2 className="mt-1 text-base font-semibold leading-tight text-podium-white">
              {market.dorChip}
            </h2>
            <p className="mt-1 truncate text-xs capitalize text-podium-gray">
              {market.nome}
              {place ? ` · ${place}` : ""}
            </p>
          </div>
          {volta ? (
            <Badge variant="neutral" className="shrink-0">
              {volta}
            </Badge>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Cue kicker="Quem" title={firstName(decisorNome)} />
          <Cue
            kicker="Sazonalidade"
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

        <SeasonCalendar
          months={market.sazonalidadeMeses}
          now={now}
          sazonalidade={market.sazonalidade}
        />

        {angulo ? (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-podium-muted">
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
