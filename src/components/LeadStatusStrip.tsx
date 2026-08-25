"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { GlassCard } from "@/components/GlassCard";
import { COPY } from "@/lib/copy";
import { crmHref } from "@/lib/back";
import { FIRST_MILE_CHIP_LABELS, type FichaMoveKey } from "@/lib/crm/cadence";
import { fichaCrmPrompt } from "@/lib/crm/ficha-prompt";
import type { LeadCrmState } from "@/lib/crm/types";

export function LeadStatusStrip({
  crm,
  searchSaved,
  wasQualified = false,
  notas,
  recordPending,
  onStage,
  onRecordCall,
  onNotasBlur,
  callAction,
}: {
  crm: LeadCrmState | null;
  searchSaved: boolean;
  wasQualified?: boolean;
  notas: string | null;
  recordPending: boolean;
  onStage: (key: FichaMoveKey) => void;
  onRecordCall: () => void;
  onNotasBlur: (notas: string) => void;
  callAction?: ReactNode;
}) {
  const crmLink = crm
    ? crmHref({ pipeline: crm.pipelineId, deal: crm.dealId })
    : "/crm";
  const prompt = fichaCrmPrompt({
    hasDeal: Boolean(crm),
    searchSaved,
    wasQualified,
  });
  const promptCopy =
    prompt === "entering"
      ? COPY.crmEnteringPista
      : prompt === "save"
        ? COPY.crmSaveListToEnter
        : COPY.crmQualifyToEnter;

  return (
    <GlassCard className="space-y-3 border-white/10 bg-white/[0.03] p-4 hover:translate-y-0">
      {callAction ? <div>{callAction}</div> : null}

      {crm?.pastFirstMile ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-podium-white">
            {crm.stageNome}
            <span className="ml-2 text-xs text-podium-muted">
              {COPY.crmPastFirstMile}
            </span>
          </p>
          <Link
            href={crmLink}
            className="ml-auto text-xs font-semibold text-podium-yellow hover:underline"
          >
            {COPY.crmOpenDeal}
          </Link>
        </div>
      ) : crm ? (
        <div className="flex flex-wrap items-center gap-2">
          {crm.firstMile.map((stage) => (
            <ChoiceTile
              key={stage.key}
              density="chip"
              title={stage.nome}
              selected={crm.stageKey === stage.key}
              onClick={() => onStage(stage.key)}
              className="min-w-0 flex-none"
            >
              {FIRST_MILE_CHIP_LABELS[stage.key]}
            </ChoiceTile>
          ))}
          <Button
            size="sm"
            variant="ghost"
            disabled={recordPending}
            onClick={onRecordCall}
            className="ml-auto gap-1.5"
          >
            <Phone className="h-3.5 w-3.5" />
            {recordPending ? "Registrando…" : "Registrei"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-podium-muted">{promptCopy}</p>
          <Button
            size="sm"
            variant="ghost"
            disabled={recordPending}
            onClick={onRecordCall}
            className="ml-auto gap-1.5"
          >
            <Phone className="h-3.5 w-3.5" />
            {recordPending ? "Registrando…" : "Registrei"}
          </Button>
        </div>
      )}

      <textarea
        defaultValue={notas ?? ""}
        onBlur={(e) => onNotasBlur(e.target.value)}
        rows={2}
        placeholder="O que rolou na ligação"
        className="w-full resize-none rounded-xl border border-white/10 bg-podium-panel px-3 py-2 text-sm outline-none focus:border-podium-yellow/40"
      />

      {crm ? (
        <p className="flex flex-wrap items-center gap-2 text-[11px] text-podium-muted">
          <span>
            {COPY.crmPistaPrefix} · {crm.pipelineNome}
          </span>
          {crm.pastFirstMile ? null : (
            <Link
              href={crmLink}
              className="font-semibold text-podium-yellow hover:underline"
            >
              {COPY.crmOpenDeal}
            </Link>
          )}
        </p>
      ) : null}
    </GlassCard>
  );
}
