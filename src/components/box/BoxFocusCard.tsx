"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import {
  BoxMeetingForm,
  BoxScheduleForm,
} from "@/components/box/BoxScheduleForm";
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
import { bookBoxMeeting } from "@/lib/box/book-meeting";
import { crmFetch } from "@/lib/crm/client";
import {
  isColdProspectingStage,
  type BoxQueueItem,
  type BoxQueueKind,
} from "@/lib/box/queue";
import { COPY } from "@/lib/copy";
import type { CrmOutcome } from "@/lib/crm/types";
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
  const [mode, setMode] = useState<
    "idle" | "complete" | "snooze" | "meeting" | "outcome"
  >("idle");
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

  async function bookMeeting(dueAt: string) {
    setSubmitting(true);
    setError(null);
    try {
      await bookBoxMeeting(
        {
          activityId: item.id,
          dealId: item.dealId,
          pipelineId: item.pipelineId,
          canonicalKey: item.canonicalKey,
          dueAt,
        },
        crmFetch,
      );
      setMode("idle");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não agendou a reunião.");
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
      setError(err instanceof Error ? err.message : "Não reagendou.");
    } finally {
      setSubmitting(false);
    }
  }

  async function setOutcome(outcome: Extract<CrmOutcome, "won" | "lost">) {
    setSubmitting(true);
    setError(null);
    try {
      await crmFetch(`/api/crm/deals/${item.dealId}/outcome`, {
        method: "POST",
        body: JSON.stringify({ outcome }),
      });
      setMode("idle");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não atualizou o status.");
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
            {qualifyHref ? (
              <Link
                href={qualifyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-5 shrink-0 items-center rounded-full border border-white/15 bg-white/[0.04] px-2 text-[10px] font-medium text-podium-gray hover:border-podium-yellow/35 hover:text-podium-white"
              >
                {COPY.boxQualify}
              </Link>
            ) : null}
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
              <button
                type="button"
                disabled={locked}
                title={COPY.boxSnooze}
                aria-expanded={mode === "snooze"}
                onClick={() => {
                  setError(null);
                  setMode((current) =>
                    current === "snooze" ? "idle" : "snooze",
                  );
                }}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center rounded-md px-2.5 text-sm font-medium md:h-7 md:text-[11px]",
                  item.signal === "overdue"
                    ? "bg-podium-alert/10 text-podium-alert hover:bg-podium-alert/20"
                    : "border border-white/15 bg-white/[0.04] text-podium-gray hover:border-podium-yellow/35 hover:text-podium-white",
                  mode === "snooze" && "ring-1 ring-podium-yellow/50",
                )}
              >
                {planned}
              </button>
            ) : null}
            {callAction}
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end md:gap-2">
            <button
              type="button"
              disabled={locked}
              aria-expanded={mode === "meeting"}
              className={cn(
                "inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-medium",
                mode === "meeting"
                  ? "border-podium-yellow/50 bg-podium-yellow/10 text-podium-yellow"
                  : "border-white/15 bg-white/[0.04] text-podium-gray hover:border-podium-yellow/35 hover:text-podium-white",
              )}
              onClick={() => {
                setError(null);
                setMode((current) =>
                  current === "meeting" ? "idle" : "meeting",
                );
              }}
            >
              {COPY.boxConfirmMeeting}
            </button>
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
            <button
              type="button"
              disabled={locked}
              aria-expanded={mode === "outcome"}
              className={cn(
                textLink,
                mode === "outcome" && "text-podium-yellow",
              )}
              onClick={() => {
                setError(null);
                setMode((current) =>
                  current === "outcome" ? "idle" : "outcome",
                );
              }}
            >
              {COPY.boxOutcome}
            </button>
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
          submitLabel={COPY.crmSaveHistory}
          onCancel={() => setMode("idle")}
          onSubmit={snooze}
        />
      ) : null}
      {mode === "meeting" ? (
        <BoxMeetingForm
          defaultDue={defaultNextDueLocal()}
          submitting={locked}
          error={error}
          onCancel={() => setMode("idle")}
          onSubmit={bookMeeting}
        />
      ) : null}
      {mode === "outcome" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={locked}
            onClick={() => void setOutcome("lost")}
            className="inline-flex h-7 items-center rounded-full border border-red-400/30 bg-red-400/10 px-2.5 text-[11px] font-medium text-red-400 hover:border-red-400/50 hover:bg-red-400/15 disabled:opacity-40"
          >
            {COPY.crmOutcomeLost}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => void setOutcome("won")}
            className="inline-flex h-7 items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 text-[11px] font-medium text-emerald-400 hover:border-emerald-400/50 hover:bg-emerald-400/15 disabled:opacity-40"
          >
            {COPY.crmOutcomeWon}
          </button>
          {error ? (
            <p className="text-[11px] text-podium-alert">{error}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
