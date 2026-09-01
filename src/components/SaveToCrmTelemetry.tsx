"use client";

import { CrmTelemetryPip } from "@/components/crm/CrmTelemetryPip";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function SaveToCrmTelemetry({
  onSave,
  label = COPY.crmSaveListToEnter,
  cta = COPY.salvarLista,
  className,
}: {
  onSave?: () => void;
  label?: string;
  cta?: string;
  className?: string;
}) {
  const inner = (
    <>
      <CrmTelemetryPip
        signal="today"
        className="mt-1.5 crm-idle-pulse"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-podium-white">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wide text-podium-yellow">
          {cta}
        </span>
        <span className="telemetry-bar mt-2 rounded-full" />
      </span>
    </>
  );
  const cls = cn(
    "flex w-full items-start gap-3 rounded-xl border border-podium-yellow/25 bg-podium-yellow/[0.07] px-3 py-2.5 text-left",
    onSave && "hover:border-podium-yellow/45 hover:bg-podium-yellow/[0.12]",
    className,
  );
  if (onSave) {
    return (
      <button type="button" onClick={onSave} className={cls}>
        {inner}
      </button>
    );
  }
  return (
    <div role="status" className={cls}>
      {inner}
    </div>
  );
}
