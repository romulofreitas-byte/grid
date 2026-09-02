import { cn } from "@/lib/utils";
import type { ActivitySignal } from "@/lib/crm/types";

const SIGNAL_CLASS: Record<ActivitySignal, string> = {
  none: "border-podium-gray bg-transparent crm-idle-pulse",
  scheduled: "border-podium-info bg-podium-info",
  today: "border-podium-yellow bg-podium-yellow",
  overdue: "border-podium-alert bg-podium-alert crm-alert-pulse",
};

const SIGNAL_LABEL: Record<ActivitySignal, string> = {
  none: "Sem próxima ação",
  scheduled: "Ação agendada",
  today: "Ação de hoje",
  overdue: "Ação atrasada",
};

export function CrmTelemetryPip({
  signal,
  className,
}: {
  signal: ActivitySignal;
  className?: string;
}) {
  return (
    <span
      title={SIGNAL_LABEL[signal]}
      aria-label={SIGNAL_LABEL[signal]}
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full border",
        SIGNAL_CLASS[signal],
        className,
      )}
    />
  );
}
