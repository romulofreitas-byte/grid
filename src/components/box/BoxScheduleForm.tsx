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
      className="mt-3 flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(kind, dueAt);
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[8rem] flex-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
            {COPY.boxNextKind}
          </span>
          <Select
            value={kind}
            onChange={(value) => setKind(nextBoxQueueKind(value as BoxQueueKind))}
            options={KIND_OPTIONS}
            size="sm"
            tone="light"
            className="mt-1 w-full"
          />
        </label>
        <label className="min-w-[11rem] flex-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
            {COPY.crmTimeLabel}
          </span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="mt-1 h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-800 outline-none focus:border-amber-400"
          />
        </label>
      </div>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
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
          className="text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
        >
          {COPY.confirmCancel}
        </Button>
      </div>
    </form>
  );
}
