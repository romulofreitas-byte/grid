"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { CRM_ACTIVITY_KIND_LABELS } from "@/lib/crm/activity";
import type { BoxQueueKind } from "@/lib/box/queue";
import { nextBoxQueueKind } from "@/lib/box/queue";
import { COPY } from "@/lib/copy";

const KIND_OPTIONS = [
  { value: "ligar", label: CRM_ACTIVITY_KIND_LABELS.ligar },
  { value: "whatsapp", label: CRM_ACTIVITY_KIND_LABELS.whatsapp },
];

export function BoxScheduleForm({
  defaultKind,
  defaultDue,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  defaultKind: BoxQueueKind;
  defaultDue: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (kind: BoxQueueKind, dueAt: string) => void;
}) {
  const [kind, setKind] = useState<BoxQueueKind>(defaultKind);
  const [dueAt, setDueAt] = useState(defaultDue);

  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(kind, dueAt);
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[8rem] flex-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted">
            {COPY.boxNextKind}
          </span>
          <Select
            value={kind}
            onChange={(value) => setKind(nextBoxQueueKind(value as BoxQueueKind))}
            options={KIND_OPTIONS}
            size="sm"
            className="mt-1 w-full"
          />
        </label>
        <label className="min-w-[11rem] flex-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted">
            {COPY.crmTimeLabel}
          </span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-white/15 bg-white/[0.04] px-2 text-base text-podium-white outline-none [color-scheme:dark] focus:border-podium-yellow/35 md:h-7 md:text-[11px]"
          />
        </label>
      </div>
      {error ? <p className="text-[11px] text-podium-alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={submitting}>
          {submitting ? "Salvando…" : COPY.boxSaveNext}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={submitting}
          onClick={onCancel}
        >
          {COPY.confirmCancel}
        </Button>
      </div>
    </form>
  );
}
