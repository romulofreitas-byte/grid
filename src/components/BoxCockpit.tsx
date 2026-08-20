"use client";

import Link from "next/link";
import { BoxDayCta } from "@/components/BoxDayCta";
import { BoxEstrutura } from "@/components/BoxEstrutura";
import { GlassCard } from "@/components/GlassCard";
import { PilotAvatar } from "@/components/PilotAvatar";
import { VoltaRing } from "@/components/VoltaRing";
import type { BoxSlot, BoxSlotId } from "@/lib/box-estrutura";
import { COPY } from "@/lib/copy";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import type { NextCallLead, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

function ClusterStat({
  label,
  value,
  href,
  hrefLabel,
  warn = false,
}: {
  label: string;
  value: string;
  href?: string;
  hrefLabel?: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-extrabold tabular-nums",
          warn ? "text-podium-yellow" : "text-podium-gray",
        )}
      >
        {value}
      </p>
      {href && hrefLabel ? (
        <Link
          href={href}
          className="mt-0.5 inline-block text-[11px] font-bold text-podium-muted hover:text-podium-white"
        >
          {hrefLabel}
        </Link>
      ) : null}
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
  };
  savedCount: number;
}) {
  const tankEmpty = billing.total === 0 || !billing.enrichAllowed;
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
                <div className="flex min-w-0 flex-1 flex-row gap-4 md:w-full md:flex-col md:gap-3 md:px-2">
                  <ClusterStat
                    label="Sequência"
                    value={
                      sequencia === 1 ? "1 dia" : `${sequencia} dias`
                    }
                  />
                  <ClusterStat
                    label="Acesso"
                    value={String(billing.total)}
                    href="/planos"
                    hrefLabel="Planos"
                    warn={tankEmpty}
                  />
                  <ClusterStat
                    label="Listas"
                    value={String(savedCount)}
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
