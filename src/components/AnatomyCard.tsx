"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/GlassCard";
import { COPY } from "@/lib/copy";
import {
  MES_CURTO,
  MES_NOME,
  mesNumero,
  peakStatusLine,
  peakMonths,
  seasonStatus,
  type SeasonStatus,
} from "@/lib/market/calendar";
import { PLANOS_PRO_URL } from "@/lib/billing/paywall";
import type { MarketBrief, MarketMunition } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEASON_PILL: Record<SeasonStatus, string | null> = {
  agora: "neste mês",
  "na-porta": "mês que vem",
  fora: "fora do pico",
  nenhuma: null,
};

type MunitionTab = "caixa" | "dono" | "lingua" | "barreiras" | "rotina";

const MUNITION_TABS: Array<{ id: MunitionTab; label: string }> = [
  { id: "caixa", label: COPY.marketChipCaixa },
  { id: "dono", label: COPY.marketChipDono },
  { id: "lingua", label: COPY.marketChipLingua },
  { id: "barreiras", label: COPY.marketChipBarreiras },
  { id: "rotina", label: COPY.marketChipRotina },
];

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
  why,
  baixa,
}: {
  months: number[];
  now: Date;
  why?: string | null;
  baixa?: string | null;
}) {
  const current = mesNumero(now);
  const peaks = peakMonths(months);
  const statusLine = peakStatusLine(months, now);
  const caption = [why?.trim(), statusLine, baixa?.trim()]
    .filter(Boolean)
    .join(" ");

  if (peaks.length === 0) {
    const empty = why?.trim() || "Sem calendário de pico curado para este nicho.";
    return (
      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-sm text-podium-muted">{empty}</p>
        {baixa?.trim() ? (
          <p className="mt-1 text-[11px] leading-relaxed text-podium-gray">
            {baixa.trim()}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <ol className="flex gap-1.5 overflow-x-auto pb-1 md:grid md:grid-cols-12 md:overflow-visible md:pb-0">
        {MES_CURTO.map((label, index) => {
          const month = index + 1;
          const inSeason = peaks.includes(month);
          const isNow = month === current;
          return (
            <li key={month} className="min-w-[3.25rem] md:min-w-0">
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
                  !inSeason && !isNow && "border-white/10 text-podium-muted",
                )}
              >
                <span className="text-[11px] font-semibold uppercase">
                  {label}
                </span>
                {inSeason ? (
                  <span className="mt-0.5 text-[10px] font-semibold uppercase opacity-80">
                    pico
                  </span>
                ) : isNow ? (
                  <span className="mt-0.5 text-[10px] font-semibold uppercase opacity-70">
                    agora
                  </span>
                ) : (
                  <span className="mt-0.5 text-[10px] opacity-0">·</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {caption ? (
        <p className="mt-2 text-[11px] leading-relaxed text-podium-gray">
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
  embedded = false,
}: {
  market: MarketBrief;
  uf?: string | null;
  decisorNome?: string | null;
  volta?: string | null;
  now?: Date;
  embedded?: boolean;
}) {
  const status = seasonStatus(market.sazonalidadeMeses, now);
  const place = [market.cidade, uf].filter(Boolean).join(" · ");
  const seasonTitle =
    status === "nenhuma"
      ? "Sem mês de pico neste nicho"
      : (market.sazonalidadeChip ?? "Janela");
  const body = (
    <div className="relative">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
            Mercado
          </p>
          <h2 className="mt-1 text-sm font-semibold leading-tight capitalize text-podium-white">
            {market.nome}
          </h2>
          {place ? (
            <p className="mt-1 truncate text-xs capitalize text-podium-gray">
              {place}
            </p>
          ) : null}
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
          {market.janelaEvitar
            ? `${COPY.marketRotinaEvitar}: ${market.janelaEvitar}`
            : null}
        </Cue>
      </div>

      <MunitionBoard market={market} />

      <SeasonCalendar
        months={market.sazonalidadeMeses}
        now={now}
        why={market.sazonalidade}
        baixa={status === "agora" ? null : market.sazonalidadeBaixa}
      />
    </div>
  );

  if (embedded) return body;

  return (
    <GlassCard className="relative shrink-0 border-white/10 bg-white/[0.03] p-5 hover:translate-y-0">
      {body}
    </GlassCard>
  );
}

function MunitionBoard({ market }: { market: MarketBrief }) {
  const full = market.munition ?? null;
  const teaser = market.dorCaixa?.trim() || null;
  const locked = Boolean(market.munitionLocked);
  const [tab, setTab] = useState<MunitionTab>("caixa");

  if (!full && !teaser && !locked) return null;

  const tabLocked = (id: MunitionTab) => id !== "caixa" && !full && locked;

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <div className="flex flex-wrap gap-1.5">
        {MUNITION_TABS.map((item) => {
          const isLocked = tabLocked(item.id);
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex h-7 items-center rounded-md border px-2 text-[10px] font-medium transition",
                selected && "ring-1 ring-podium-yellow/40",
                isLocked
                  ? "border-dashed border-white/15 bg-transparent text-podium-muted hover:border-white/25"
                  : selected
                    ? "border-podium-yellow/55 bg-podium-yellow/10 text-podium-yellow"
                    : "border-white/15 bg-white/[0.03] text-podium-gray hover:border-white/25 hover:text-podium-white",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        {tabLocked(tab) ? (
          <MunitionLockedPanel />
        ) : (
          <MunitionPanel
            tab={tab}
            munition={full}
            teaser={teaser}
          />
        )}
      </div>
    </div>
  );
}

function MunitionLockedPanel() {
  return (
    <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[11px] leading-relaxed text-podium-muted">
        {COPY.marketMunitionHint}
      </p>
      <Link
        href={PLANOS_PRO_URL}
        className="mt-1.5 inline-block text-[11px] font-medium text-podium-yellow hover:underline"
      >
        {COPY.marketMunitionCta}
      </Link>
    </div>
  );
}

function MunitionPanel({
  tab,
  munition,
  teaser,
}: {
  tab: MunitionTab;
  munition: MarketMunition | null;
  teaser: string | null;
}) {
  if (tab === "caixa") {
    const items = munition?.doresFaturamento?.length
      ? munition.doresFaturamento
      : teaser
        ? [teaser]
        : [];
    return <MunitionList items={items} />;
  }
  if (!munition) return null;
  if (tab === "dono") {
    return <MunitionList items={munition.urgenciasOcultas} />;
  }
  if (tab === "lingua") {
    return (
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {munition.termosRamo.map((term) => (
          <li
            key={term}
            className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-snug text-podium-gray"
          >
            {term}
          </li>
        ))}
      </ul>
    );
  }
  if (tab === "barreiras") {
    return <MunitionList items={munition.barreirasDecisao} />;
  }
  return <RotinaBands rotina={munition.rotinaEstresse} />;
}

function ligarBandFromJanela(
  janela: string,
): "manha" | "tarde" | "noite" | null {
  const t = janela.toLowerCase();
  if (t.includes("tarde")) return "tarde";
  if (t.includes("manhã") || t.includes("manha")) return "manha";
  if (t.includes("noite")) return "noite";
  return null;
}

function RotinaBands({
  rotina,
}: {
  rotina: MarketMunition["rotinaEstresse"];
}) {
  const live = ligarBandFromJanela(rotina.janelaLigar);
  const bands: Array<{
    id: "manha" | "tarde" | "noite" | "evitar";
    label: string;
    text: string;
  }> = [
    { id: "manha", label: COPY.marketRotinaManha, text: rotina.manha },
    { id: "tarde", label: COPY.marketRotinaTarde, text: rotina.tarde },
    { id: "noite", label: COPY.marketRotinaNoite, text: rotina.noite },
    { id: "evitar", label: COPY.marketRotinaEvitar, text: rotina.evitar },
  ];

  return (
    <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {bands.map((band) => {
        const isLive = band.id === live;
        return (
          <li key={band.id}>
            <span
              className={cn(
                "flex min-h-[4.5rem] flex-col rounded-lg border px-3 py-2",
                isLive &&
                  "border-podium-yellow bg-podium-yellow text-podium-navy",
                !isLive &&
                  band.id === "evitar" &&
                  "border-white/10 bg-white/[0.02] text-podium-muted",
                !isLive &&
                  band.id !== "evitar" &&
                  "border-white/10 bg-white/[0.03] text-podium-gray",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-[0.12em]",
                    isLive ? "opacity-80" : "text-podium-muted",
                  )}
                >
                  {band.label}
                </span>
                {isLive ? (
                  <span className="text-[8px] font-semibold uppercase opacity-80">
                    {COPY.marketRotinaLigar}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 text-[11px] leading-snug">{band.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function MunitionList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-podium-gray"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
