"use client";

import { Phone } from "lucide-react";
import { LANDING_LEADS } from "@/components/landing/demo-leads";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { PositionBadge } from "@/components/PositionBadge";
import { SectionTitle } from "@/components/SectionTitle";
import { TourChrome } from "@/components/tour/TourChrome";
import { VoltaRing } from "@/components/VoltaRing";
import { COPY } from "@/lib/copy";
import type { TourScene } from "@/lib/tour";
import { cn } from "@/lib/utils";

const DEMO_SCORES = [91, 76, 58, 44, 31] as const;

function TourPainelMock() {
  return (
    <div className="space-y-8">
      <div data-tour="painel">
        <SectionTitle>{COPY.painelTitle}</SectionTitle>
        <Hint className="mt-1 max-w-xl">{COPY.painelHint}</Hint>
      </div>

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <GlassCard className="p-5" hover={false} data-tour="painel-meta">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <VoltaRing hoje={0} meta={20} size="lg" className="mx-auto sm:mx-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
                Trabalho do dia
              </p>
              <p className="mt-1 text-xl font-extrabold leading-tight">
                {COPY.painelCallsLeft.replace("{n}", "20")}
              </p>
              <span
                data-tour="ligar-agora"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-podium-yellow px-5 py-2.5 text-sm font-extrabold text-podium-navy"
              >
                <Phone className="h-4 w-4" />
                Ligar agora
              </span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="flex h-full flex-col p-5" hover={false}>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
            Resultado
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-podium-muted">
                Faturado
              </p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">—</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-podium-muted">
                Pipeline
              </p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">—</p>
            </div>
          </div>
          <Hint className="mt-4">Libere o CRM para ver o faturado.</Hint>
        </GlassCard>
      </div>
    </div>
  );
}

function TourGridMock() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle>{COPY.tourDemoListName}</SectionTitle>
          <Hint className="mt-1">{COPY.landingPreviewReady}</Hint>
        </div>
        <span
          data-tour="grid-save"
          className="inline-flex h-8 items-center rounded-md bg-gradient-to-b from-[#ffc933] to-podium-yellow px-3 text-xs font-medium text-podium-navy"
        >
          {COPY.salvarLista}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-tour="grid-order">
        <span className="inline-flex items-baseline gap-1.5 rounded-md bg-white/5 px-2.5 py-1">
          <span className="text-sm font-semibold tabular-nums leading-none">
            {LANDING_LEADS.length}
          </span>
          <span className="text-[11px] font-medium text-podium-muted">leads</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1">
          <span className="inline-flex items-center justify-center rounded-md bg-podium-yellow px-1.5 py-0.5 text-[10px] font-medium text-podium-navy">
            P1
          </span>
          <span className="text-[11px] font-medium text-podium-gray">
            {COPY.gridLigarOrdem}
          </span>
        </span>
        <span className="rounded-full border border-podium-yellow/30 bg-podium-yellow/10 px-3 py-1 text-xs font-semibold text-podium-yellow">
          {COPY.landingPreviewFilter}
        </span>
      </div>

      <span
        data-tour="grid-qualify"
        className="inline-flex h-8 items-center rounded-md bg-gradient-to-b from-[#ffc933] to-podium-yellow px-3 text-xs font-medium text-podium-navy"
      >
        {COPY.qualificarMetaHoje} (20)
      </span>

      <GlassCard className="hidden hover:translate-y-0 md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-podium-muted">
            <tr>
              <th className="w-20 px-3 py-2">Pos.</th>
              <th className="px-3 py-2">Empresa</th>
              <th className="w-40 px-3 py-2">Telefone</th>
              <th className="w-44 px-3 py-2">Decisor</th>
            </tr>
          </thead>
          <tbody>
            {LANDING_LEADS.map((lead, i) => (
              <tr
                key={lead.pos}
                data-tour={i === 0 ? "grid-row" : undefined}
                className={cn(
                  "border-b border-white/5",
                  i === 0 && "bg-podium-yellow/[0.04]",
                )}
              >
                <td className="px-3 py-2">
                  <PositionBadge
                    position={lead.pos}
                    score={DEMO_SCORES[i] ?? 40}
                    hasAudit={i < 2}
                  />
                </td>
                <td className="min-w-0 px-3 py-2">
                  <p className="truncate font-semibold">{lead.empresa}</p>
                  <p className="truncate text-xs text-podium-muted">{lead.cidade}</p>
                </td>
                <td className="px-3 py-2 font-medium tabular-nums">{lead.telefone}</td>
                <td className="px-3 py-2">{lead.socio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <div className="space-y-3 md:hidden">
        {LANDING_LEADS.map((lead, i) => (
          <GlassCard
            key={lead.pos}
            hover={false}
            data-tour={i === 0 ? "grid-row" : undefined}
            className={cn("p-4", i === 0 && "bg-podium-yellow/[0.04]")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{lead.empresa}</p>
                <p className="text-xs text-podium-muted">{lead.cidade}</p>
              </div>
              <PositionBadge
                position={lead.pos}
                score={DEMO_SCORES[i] ?? 40}
                hasAudit={i < 2}
              />
            </div>
            <p className="mt-2 text-sm font-medium tabular-nums">{lead.telefone}</p>
            <p className="text-sm text-podium-gray">{lead.socio}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

export function TourStage({ scene }: { scene: TourScene }) {
  return (
    <TourChrome scene={scene}>
      {scene === "grid" ? <TourGridMock /> : <TourPainelMock />}
    </TourChrome>
  );
}
