"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Flame, List, Wallet } from "lucide-react";
import { BoxDayCta } from "@/components/BoxDayCta";
import { BoxEstrutura } from "@/components/BoxEstrutura";
import { GlassCard } from "@/components/GlassCard";
import { PilotAvatar } from "@/components/PilotAvatar";
import { VoltaRing } from "@/components/VoltaRing";
import type { BoxSlot, BoxSlotId } from "@/lib/box-estrutura";
import { planosHref } from "@/lib/billing/href";
import { COPY } from "@/lib/copy";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import type { NextCallLead, Profile, Search } from "@/lib/types";
import { writeWorkingSearchCookie } from "@/lib/working-search";
import { cn } from "@/lib/utils";

function sequenciaHint(n: number): string {
  if (n <= 0) return COPY.boxSequenciaHintZero;
  if (n === 1) return COPY.boxSequenciaHintOne;
  return COPY.boxSequenciaHintMany.replace("{n}", String(n));
}

function acessoHint(n: number): string {
  return COPY.boxAcessoHint.replace("{n}", String(n));
}

function listasHint(n: number): string {
  if (n <= 0) return COPY.boxListasHintZero;
  if (n === 1) return COPY.boxListasHintOne;
  return COPY.boxListasHintMany.replace("{n}", String(n));
}

function ClusterCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  hrefLabel,
  warn = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  href?: string;
  hrefLabel?: string;
  warn?: boolean;
}) {
  return (
    <div
      className="group relative min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 outline-none md:px-3 md:py-2.5"
      tabIndex={href ? undefined : 0}
      aria-label={hint}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
        {label}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            warn ? "text-podium-yellow" : "text-podium-muted",
          )}
          aria-hidden
        />
        <p
          className={cn(
            "truncate text-sm font-extrabold tabular-nums",
            warn ? "text-podium-yellow" : "text-podium-gray",
          )}
        >
          {value}
        </p>
      </div>
      {href && hrefLabel ? (
        <Link
          href={href}
          className="mt-0.5 inline-block text-[11px] font-bold text-podium-muted hover:text-podium-white"
        >
          {hrefLabel}
        </Link>
      ) : null}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-20 hidden rounded-lg border border-white/10 bg-podium-navy/95 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-podium-gray shadow-lg",
          "group-hover:flex group-focus-within:flex",
          "inset-0 items-center justify-center px-2 text-center",
          "md:inset-auto md:right-full md:top-1/2 md:mr-2 md:w-max md:max-w-[14rem] md:-translate-y-1/2 md:text-left",
        )}
      >
        {hint}
      </span>
    </div>
  );
}

export function BoxCockpit({
  name,
  profile,
  slots,
  defaultOpen,
  unsavedSearch,
  next,
  hoje,
  meta,
  sequencia,
  pistaAberta,
  connections,
  billing,
  savedCount,
  savedLists,
  workingSearchId,
}: {
  name: string;
  profile: Pick<Profile, "foto_url" | "como_chama" | "nome">;
  slots: BoxSlot[];
  defaultOpen: BoxSlotId | null;
  unsavedSearch: { id: string; nome: string } | null;
  next: NextCallLead | null;
  hoje: number;
  meta: number;
  sequencia: number;
  pistaAberta: boolean;
  connections: IntegrationConnectionPublic[];
  billing: {
    total: number;
    plan: number;
    pack: number;
    plano: string;
    enrichAllowed: boolean;
    trialDaysLeft?: number | null;
    trialExpired?: boolean;
  };
  savedCount: number;
  savedLists: Pick<Search, "id" | "nome">[];
  workingSearchId: string | null;
}) {
  const router = useRouter();
  const tankEmpty = billing.total === 0 || !billing.enrichAllowed;
  const workingMismatch =
    Boolean(workingSearchId) && next != null && next.searchId !== workingSearchId;
  const missionTitle = !pistaAberta
    ? COPY.boxPistaFechada
    : next
      ? hoje === 0
        ? `Ligar o P${next.gridPosition}`
        : "Continuar a volta"
      : "Criar e qualificar lista";
  const missionBody = !pistaAberta
    ? COPY.boxSemLista
    : next
      ? `${next.nome}. Ligar conta a volta.`
      : "A lista salva não tem P novo. Monte outra ou volte no grid.";

  return (
    <GlassCard hover={false} highlight={pistaAberta} className="overflow-hidden p-0">
      <BoxEstrutura
        slots={slots}
        defaultOpen={defaultOpen}
        pistaAberta={pistaAberta}
      >
        {({ lamps, well }) => (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-3 md:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <PilotAvatar profile={profile} size="sm" />
                <div className="min-w-0">
                  <p className="text-[11px] text-podium-muted">Bem-vindo de volta</p>
                  <p className="truncate text-sm font-bold md:text-base">{name}</p>
                </div>
              </div>
              {lamps}
            </div>

            <div className="flex flex-col md:flex-row">
              <div className="relative min-w-0 flex-1 overflow-hidden px-5 py-8 md:w-[65%] md:px-8 md:py-10">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-16 top-4 h-72 w-72 bg-[radial-gradient(circle,rgba(245,179,1,0.10),transparent_65%)]"
                />
                <div className="relative">
                  {well}
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-muted">
                    Trabalho do dia
                  </p>
                  <h1 className="mt-3 max-w-xl text-4xl font-extrabold leading-[1.05] md:text-5xl">
                    {missionTitle}
                  </h1>
                  <p className="mt-3 max-w-lg text-sm text-podium-gray md:text-base">
                    {missionBody}
                  </p>
                  {pistaAberta && savedLists.length > 0 ? (
                    <label className="mt-4 block max-w-sm">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
                        {COPY.listaDaVolta}
                      </span>
                      <select
                        value={workingSearchId && savedLists.some((s) => s.id === workingSearchId) ? workingSearchId : (next?.searchId ?? savedLists[0]?.id ?? "")}
                        onChange={(e) => {
                          writeWorkingSearchCookie(e.target.value || null);
                          router.refresh();
                        }}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2 text-sm text-podium-white outline-none focus:border-podium-yellow/40"
                      >
                        {savedLists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.nome}
                          </option>
                        ))}
                      </select>
                      {workingMismatch ? (
                        <span className="mt-1 block text-[11px] text-podium-yellow">
                          {COPY.listaDaVoltaFallback}
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                  <div className="mt-6">
                    <BoxDayCta
                      next={next}
                      hoje={hoje}
                      pistaAberta={pistaAberta}
                      unsavedSearch={unsavedSearch}
                      connections={connections}
                    />
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "flex flex-row items-center gap-5 border-t border-white/[0.06] bg-black/35 px-5 py-5",
                  "md:w-[35%] md:flex-col md:items-center md:justify-center md:gap-6 md:border-l md:border-t-0 md:px-6 md:py-10",
                )}
              >
                <div className="relative shrink-0">
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-0 scale-[1.7] bg-[radial-gradient(circle,rgba(245,179,1,0.16),transparent_62%)]",
                      !pistaAberta && "opacity-30",
                    )}
                  />
                  <VoltaRing
                    hoje={hoje}
                    meta={meta}
                    muted={!pistaAberta}
                    size="lg"
                    className="relative"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2 md:w-full md:gap-3 md:px-2">
                  <ClusterCard
                    label="Sequência"
                    value={
                      sequencia === 1 ? "1 dia" : `${sequencia} dias`
                    }
                    hint={sequenciaHint(sequencia)}
                    icon={Flame}
                  />
                  <ClusterCard
                    label="Acesso"
                    value={String(billing.total)}
                    hint={acessoHint(billing.total)}
                    icon={Wallet}
                    href={planosHref("/box")}
                    hrefLabel={
                      billing.trialDaysLeft != null && billing.trialDaysLeft > 0
                        ? `${billing.trialDaysLeft} dias de trial`
                        : "Planos"
                    }
                    warn={tankEmpty}
                  />
                  <ClusterCard
                    label="Listas"
                    value={String(savedCount)}
                    hint={listasHint(savedCount)}
                    icon={List}
                    href="/listas"
                    hrefLabel="Ver listas"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </BoxEstrutura>
    </GlassCard>
  );
}
