"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, MessageCircle, Phone } from "lucide-react";
import { BoxFocusNoteCard } from "@/components/box/BoxFocusNoteCard";
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
import { Button, buttonClassName } from "@/components/ui/Button";
import { leadHref, leadHrefForCnpj } from "@/lib/back";
import {
  defaultNextDueLocal,
  formatDueLabel,
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

type FocusMode = "idle" | "complete" | "snooze" | "meeting" | "outcome";

const chip =
  "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-medium";

const chipAction =
  "h-7 shrink-0 px-2.5 text-[11px]";

const quiet =
  "text-[11px] text-podium-muted hover:text-podium-yellow hover:underline disabled:opacity-40";

const primaryCta =
  "h-11 w-full justify-center text-sm md:h-8 md:w-auto md:px-3.5 md:text-xs";

const secondaryCta =
  "h-11 w-full justify-center text-sm md:h-8 md:w-auto md:text-[11px]";

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
  const [mode, setMode] = useState<FocusMode>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [awaitingComplete, setAwaitingComplete] = useState(false);
  const awaitingKey = `box-awaiting-complete:${item.id}`;
  const callConnection = pickCallConnection(connections);
  const tel = pickBoxTel(item);
  const waHref = pickBoxWaHref(item);
  const dueLabel = formatDueLabel(item.dueAt);
  const locked = busy || submitting;
  const phoneLabel = tel ? formatBoxPhoneDisplay(tel.phone) : COPY.boxNoPhone;
  const cold = isColdProspectingStage(item.canonicalKey);
  const prospectChip = cold ? COPY.boxColdChip : COPY.boxFollowupChip;
  const leadDigits = item.cnpj?.replace(/\D/g, "") ?? "";
  const qualifyHref =
    leadDigits.length === 14
      ? item.searchId
        ? leadHref(leadDigits, item.searchId, "box")
        : leadHrefForCnpj(leadDigits)
      : null;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(awaitingKey) === "1") setAwaitingComplete(true);
    } catch {
      /* ignore quota / private mode */
    }
  }, [awaitingKey]);

  useEffect(() => {
    setCopiedPhone(false);
  }, [item.id, phoneLabel]);

  function markAwaitingComplete() {
    setAwaitingComplete(true);
    try {
      sessionStorage.setItem(awaitingKey, "1");
    } catch {
      /* ignore quota / private mode */
    }
  }

  function clearAwaitingComplete() {
    try {
      sessionStorage.removeItem(awaitingKey);
    } catch {
      /* ignore quota / private mode */
    }
  }

  function toggle(next: Exclude<FocusMode, "idle">) {
    setError(null);
    setMode((current) => (current === next ? "idle" : next));
  }

  async function copyPhone() {
    if (!tel) return;
    try {
      await navigator.clipboard.writeText(phoneLabel);
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 1600);
    } catch {
      return;
    }
  }

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
      clearAwaitingComplete();
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
      clearAwaitingComplete();
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
      clearAwaitingComplete();
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
      clearAwaitingComplete();
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
          onClick={() => markAwaitingComplete()}
          className={buttonClassName({
            variant: "primary",
            size: "md",
            className: primaryCta,
          })}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
      ) : null
    ) : tel || callConnection ? (
      <CallButton
        variant="cockpit"
        telHref={tel?.href ?? null}
        connection={callConnection}
        cnpj={item.cnpj}
        searchId={item.searchId}
        to={tel?.phone}
        label="Ligar"
        titleHint="Ligar"
        companyName={item.companyName}
        phoneLabel={tel ? formatBoxPhoneDisplay(tel.phone) : null}
        className={primaryCta}
        onCalled={() => {
          markAwaitingComplete();
          onCalled?.();
        }}
      />
    ) : null;

  const qualifyAction = qualifyHref ? (
    <Link
      href={qualifyHref}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClassName({
        variant: "accent",
        size: "sm",
        className: secondaryCta,
      })}
    >
      {COPY.boxQualify}
    </Link>
  ) : null;

  return (
    <article className="min-w-0 shrink-0 border-b border-white/10 bg-white/[0.02] px-4 py-4">
      <div className="w-full min-w-0 md:max-w-[48rem]">
      <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_22rem] md:items-start">
        <header className="min-w-0 md:col-start-1 md:row-start-1">
          <div className="flex min-w-0 items-center gap-2">
            <CrmTelemetryPip signal={item.signal} />
            <button
              type="button"
              onClick={onOpenDeal}
              title="Abrir ficha"
              className="min-w-0 truncate text-left text-base font-medium tracking-tight text-podium-white hover:text-podium-yellow"
            >
              {item.companyName}
            </button>
            {dueLabel ? (
              <button
                type="button"
                disabled={locked}
                title={COPY.boxSnooze}
                aria-expanded={mode === "snooze"}
                onClick={() => toggle("snooze")}
                className={cn(
                  "inline-flex shrink-0 items-center rounded-md px-2 py-1 text-[11px] font-medium tabular-nums",
                  item.signal === "overdue"
                    ? "bg-podium-alert/10 text-podium-alert hover:bg-podium-alert/20"
                    : "bg-white/10 text-podium-gray hover:bg-white/15 hover:text-podium-white",
                  mode === "snooze" && "ring-1 ring-podium-yellow/50",
                )}
              >
                {dueLabel}
              </button>
            ) : null}
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
            {item.stageNome ? (
              <span className="text-[11px] text-podium-gray">{item.stageNome}</span>
            ) : null}
            <span
              className={cn(
                chip,
                cold
                  ? "border-white/10 text-podium-muted"
                  : "border-podium-yellow/40 bg-podium-yellow/10 text-podium-yellow",
              )}
            >
              {prospectChip}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={locked}
              aria-expanded={mode === "meeting"}
              className={cn(
                chipAction,
                mode === "meeting" && "ring-1 ring-podium-yellow/50",
              )}
              onClick={() => toggle("meeting")}
            >
              {COPY.boxConfirmMeeting}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={locked}
              aria-expanded={mode === "complete"}
              className={cn(
                chipAction,
                awaitingComplete && "recommend-pulse",
                mode === "complete" && "ring-1 ring-podium-yellow/50",
              )}
              onClick={() => toggle("complete")}
            >
              {COPY.boxComplete}
            </Button>
          </div>
          {item.contactName ? (
            <p className="mt-2 truncate text-sm font-medium text-podium-white">
              {item.contactName}
            </p>
          ) : null}
          {tel ? (
            <button
              type="button"
              title={copiedPhone ? COPY.crmCopiedPhone : COPY.crmCopyPhone}
              aria-label={copiedPhone ? COPY.crmCopiedPhone : COPY.crmCopyPhone}
              onClick={() => void copyPhone()}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-podium-gray transition hover:border-white/20 hover:bg-white/[0.08] hover:text-podium-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40",
                item.contactName ? "mt-0.5" : "mt-2",
              )}
            >
              {copiedPhone ? (
                <Check className="h-3 w-3 text-podium-yellow" />
              ) : (
                <Phone className="h-3 w-3" />
              )}
              {phoneLabel}
            </button>
          ) : (
            <p
              className={cn(
                "font-mono text-xs tabular-nums text-podium-muted",
                item.contactName ? "mt-0.5" : "mt-2",
              )}
            >
              {phoneLabel}
            </p>
          )}
        </header>

        <BoxFocusNoteCard
          dealId={item.dealId}
          lastNote={item.lastNote}
          locked={locked}
          className="min-w-0 md:col-start-2 md:row-start-1 md:row-span-2"
        />

        <div className="flex min-w-0 flex-col gap-2 md:col-start-1 md:row-start-2">
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            {callAction}
            {qualifyAction}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={locked}
              aria-expanded={mode === "snooze"}
              className={cn(
                secondaryCta,
                mode === "snooze" && "ring-1 ring-podium-yellow/50",
              )}
              onClick={() => toggle("snooze")}
            >
              {COPY.boxSnooze}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {mode === "outcome" ? (
              <>
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
              </>
            ) : null}
            <button
              type="button"
              disabled={locked}
              aria-expanded={mode === "outcome"}
              className={cn(quiet, mode === "outcome" && "text-podium-yellow")}
              onClick={() => toggle("outcome")}
            >
              {COPY.boxOutcome}
            </button>
            {mode === "outcome" && error ? (
              <p className="text-[11px] text-podium-alert">{error}</p>
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
      </div>
    </article>
  );
}
