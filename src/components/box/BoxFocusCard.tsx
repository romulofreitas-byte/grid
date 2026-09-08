"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BoxScheduleForm } from "@/components/box/BoxScheduleForm";
import {
  formatBoxPhoneDisplay,
  pickBoxTel,
  pickBoxWaHref,
} from "@/components/box/dial";
import { CallButton } from "@/components/CallButton";
import { CrmTelemetryPip } from "@/components/crm/CrmTelemetryPip";
import { leadHref, leadHrefForCnpj } from "@/lib/back";
import {
  defaultNextDueLocal,
  formatPlannedActivity,
  toDatetimeLocal,
} from "@/lib/crm/activity";
import { crmFetch } from "@/lib/crm/client";
import {
  isColdProspectingStage,
  type BoxQueueItem,
  type BoxQueueKind,
} from "@/lib/box/queue";
import { COPY } from "@/lib/copy";
import { pickCallConnection } from "@/lib/integrations/call-target";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import { cn } from "@/lib/utils";

const textLink =
  "text-[11px] text-podium-muted hover:text-podium-yellow hover:underline disabled:opacity-40";

const waCall =
  "inline-flex h-7 items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-2.5 text-[11px] font-medium text-podium-gray hover:border-podium-yellow/35 hover:bg-white/[0.08] hover:text-podium-white";

const actionBtn =
  "h-11 w-full justify-center text-sm md:h-7 md:w-auto md:text-[11px]";

export function BoxFocusCard({
  item,
  connections,
  busy,
  onOpenDeal,
  onCalled,
  onDone,
}: {
  item: BoxQueueItem;
  connections: IntegrationConnectionPublic[];
  busy: boolean;
  onOpenDeal: () => void;
  onCalled?: () => void;
  onDone: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"idle" | "complete" | "snooze">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const callConnection = pickCallConnection(connections);
  const tel = pickBoxTel(item);
  const waHref = pickBoxWaHref(item);
  const planned = formatPlannedActivity({
    kind: item.kind,
    due_at: item.dueAt,
    status: "open",
  });
  const locked = busy || submitting;
  const phoneLabel = tel ? formatBoxPhoneDisplay(tel.phone) : COPY.boxNoPhone;
  const prospectChip = isColdProspectingStage(item.canonicalKey)
    ? COPY.boxColdChip
    : COPY.boxFollowupChip;
  const leadDigits = item.cnpj?.replace(/\D/g, "") ?? "";
  const qualifyHref =
    leadDigits.length === 14
      ? item.searchId
        ? leadHref(leadDigits, item.searchId, "box")
        : leadHrefForCnpj(leadDigits)
      : null;

  async function completeThenSchedule(kind: BoxQueueKind, dueAt: string) {
    setSubmitting(true);
    setError(null);
    try {
      await crmFetch(`/api/crm/deals/${item.dealId}/complete`, {
        method: "POST",
        body: JSON.stringify({ activityId: item.id }),
      });
      await crmFetch(`/api/crm/deals/${item.dealId}/schedule`, {
        method: "POST",
        body: JSON.stringify({ kind, dueAt }),
      });
      setMode("idle");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não concluiu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function snooze(kind: BoxQueueKind, dueAt: string) {
    setSubmitting(true);
    setError(null);
    try {
      await crmFetch(`/api/crm/deals/${item.dealId}/schedule`, {
        method: "POST",
        body: JSON.stringify({ kind, dueAt, activityId: item.id }),
      });
      setMode("idle");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não adiou.");
    } finally {
      setSubmitting(false);
    }
  }

  const callAction =
    item.kind === "whatsapp" ? (
      waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(waCall, actionBtn)}
        >
          <MessageCircle className="h-4 w-4 md:h-3.5 md:w-3.5" />
          WhatsApp
        </a>
      ) : null
    ) : tel || callConnection ? (
      <CallButton
        telHref={tel?.href ?? null}
        connection={callConnection}
        cnpj={item.cnpj}
        searchId={item.searchId}
        to={tel?.phone}
        label="Ligar"
        titleHint="Ligar"
        companyName={item.companyName}
        phoneLabel={tel ? formatBoxPhoneDisplay(tel.phone) : null}
        className={actionBtn}
        onCalled={onCalled}
      />
    ) : null;

  return (
    <article className="shrink-0 border-b border-white/10 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <CrmTelemetryPip signal={item.signal} />
            <button
              type="button"
              onClick={onOpenDeal}
              title="Abrir ficha"
              className="min-w-0 truncate text-left text-base font-medium tracking-tight text-podium-white hover:text-podium-yellow md:text-sm"
            >
              {item.companyName}
            </button>
          </div>
          <p className="mt-1 truncate font-mono text-sm text-podium-gray md:text-[12px]">
            {phoneLabel}
          </p>
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-podium-muted md:text-[11px]">
            {[item.contactName, item.stageNome].filter(Boolean).join(" · ")}
            {item.contactName || item.stageNome ? (
              <span aria-hidden="true">·</span>
            ) : null}
            <span className="rounded-sm bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-podium-gray">
              {prospectChip}
            </span>
          </p>
          {item.lastNote ? (
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-podium-muted">
              {item.lastNote}
            </p>
          ) : null}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto md:items-end">
          <div className="flex w-full items-stretch gap-2 md:w-auto md:justify-end">
            {planned ? (
              <span
                className={cn(
                  "inline-flex h-11 shrink-0 items-center rounded-md px-2.5 text-sm font-medium md:h-7 md:text-[11px]",
                  item.signal === "overdue"
                    ? "bg-podium-alert/10 text-podium-alert"
                    : "border border-white/15 bg-white/[0.04] text-podium-gray",
                )}
              >
                {planned}
              </span>
            ) : null}
            {callAction}
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end md:gap-2">
            <button
              type="button"
              disabled={locked}
              className={textLink}
              onClick={() => {
                setError(null);
                setMode((current) => (current === "complete" ? "idle" : "complete"));
              }}
            >
              {COPY.boxComplete}
            </button>
            <button
              type="button"
              disabled={locked}
              className={textLink}
              onClick={() => {
                setError(null);
                setMode((current) => (current === "snooze" ? "idle" : "snooze"));
              }}
            >
              {COPY.boxSnooze}
            </button>
            {qualifyHref ? (
              <Link
                href={qualifyHref}
                target="_blank"
                rel="noopener noreferrer"
                className={textLink}
              >
                {COPY.boxQualify}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      {mode === "complete" ? (
        <BoxScheduleForm
          defaultKind={item.kind}
          defaultDue={defaultNextDueLocal()}
          submitting={locked}
          error={error}
          onCancel={() => setMode("idle")}
          onSubmit={completeThenSchedule}
        />
      ) : null}
      {mode === "snooze" ? (
        <BoxScheduleForm
          defaultKind={item.kind}
          defaultDue={toDatetimeLocal(item.dueAt)}
          submitting={locked}
          error={error}
          onCancel={() => setMode("idle")}
          onSubmit={snooze}
        />
      ) : null}
    </article>
  );
}
