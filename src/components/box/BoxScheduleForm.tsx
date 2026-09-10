"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { CrmDateTimePicker } from "@/components/crm/CrmDateTimePicker";
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
  submitLabel,
  onCancel,
  onSubmit,
}: {
  defaultKind: BoxQueueKind;
  defaultDue: string;
  submitting: boolean;
  error: string | null;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (kind: BoxQueueKind, dueAt: string) => void;
}) {
  const [kind, setKind] = useState<BoxQueueKind>(defaultKind);
  const [dueAt, setDueAt] = useState(defaultDue);

  return (
    <form
      className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(kind, dueAt);
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[8rem] max-w-[12rem] flex-1">
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
        <div className="min-w-[14rem] flex-1">
          <CrmDateTimePicker
            value={dueAt}
            onChange={setDueAt}
            className="mt-1 max-w-none"
          />
        </div>
      </div>
      {error ? <p className="text-[11px] text-podium-alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={submitting}>
          {submitting ? "Salvando…" : submitLabel ?? COPY.boxSaveNext}
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

export function BoxMeetingForm({
  defaultDue,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  defaultDue: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (dueAt: string) => void;
}) {
  const [dueAt, setDueAt] = useState(defaultDue);

  return (
    <form
      className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(dueAt);
      }}
    >
      <div className="max-w-md">
        <CrmDateTimePicker
          value={dueAt}
          onChange={setDueAt}
          className="max-w-none"
        />
      </div>
      {error ? <p className="text-[11px] text-podium-alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={submitting}>
          {submitting ? "Salvando…" : COPY.boxSaveMeeting}
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
