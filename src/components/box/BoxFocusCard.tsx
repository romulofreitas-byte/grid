"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { BoxScheduleForm } from "@/components/box/BoxScheduleForm";
import {
  formatBoxPhoneDisplay,
  pickBoxTel,
  pickBoxWaHref,
} from "@/components/box/dial";
import { CallButton } from "@/components/CallButton";
import { CrmTelemetryPip } from "@/components/crm/CrmTelemetryPip";
import {
  defaultNextDueLocal,
  formatPlannedActivity,
  toDatetimeLocal,
} from "@/lib/crm/activity";
import { crmFetch } from "@/lib/crm/client";
import type { BoxQueueItem, BoxQueueKind } from "@/lib/box/queue";
import { COPY } from "@/lib/copy";
import { pickCallConnection } from "@/lib/integrations/call-target";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import { cn } from "@/lib/utils";

const outlineLink =
  "text-[11px] text-zinc-500 hover:text-amber-700 hover:underline";

const outlineCall =
  "border-zinc-200 bg-white text-zinc-800 shadow-none hover:border-amber-400 hover:bg-amber-50 hover:text-zinc-900 hover:shadow-none";

export function BoxFocusCard({
  item,
  connections,
  busy,
  onDone,
}: {
  item: BoxQueueItem;
  connections: IntegrationConnectionPublic[];
  busy: boolean;
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

  async function completeThenSchedule(kind: BoxQueueKind, dueAt: string) {
    setSubmitting(true);
    setError(null);
    try {
      await crmFetch(`/api/crm/deals/${item.dealId}/complete`, { method: "POST" });
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
        body: JSON.stringify({ kind, dueAt }),
      });
      setMode("idle");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não adiou.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="shrink-0 border-b border-zinc-200 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <CrmTelemetryPip signal={item.signal} />
            <p className="truncate text-sm font-medium tracking-tight text-zinc-800">
              {item.companyName}
            </p>
          </div>
          <p className="mt-1 truncate font-mono text-[12px] text-zinc-600">
            {phoneLabel}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-400">
            {[
              item.contactName,
              item.stageNome,
              planned,
              item.pipelineNome,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {item.kind === "whatsapp" ? (
            waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium",
                  outlineCall,
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            ) : null
          ) : tel || callConnection ? (
            <CallButton
              variant="box"
              telHref={tel?.href ?? null}
              connection={callConnection}
              cnpj={item.cnpj}
              searchId={item.searchId}
              to={tel?.phone}
              label="Ligar"
              titleHint="Ligar"
              companyName={item.companyName}
              phoneLabel={tel ? formatBoxPhoneDisplay(tel.phone) : null}
            />
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={locked}
              className={outlineLink}
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
              className={outlineLink}
              onClick={() => {
                setError(null);
                setMode((current) => (current === "snooze" ? "idle" : "snooze"));
              }}
            >
              {COPY.boxSnooze}
            </button>
            <Link
              href={`/crm?deal=${item.dealId}&pipeline=${item.pipelineId}`}
              className={outlineLink}
            >
              {COPY.boxOpenCrm}
            </Link>
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
