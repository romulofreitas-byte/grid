import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/GlassCard";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export type FocusStep = {
  id: string;
  title: string;
  status: "todo" | "current" | "done";
  disabled?: boolean;
};

export function IntegrationFocusPanel({
  steps,
  onStep,
  actions,
  help,
  children,
  className,
}: {
  steps?: FocusStep[];
  onStep?: (id: string) => void;
  actions?: ReactNode;
  help?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <GlassCard
      highlight
      className={cn("flex flex-col gap-5 p-4 hover:translate-y-0 sm:p-6", className)}
    >
      {steps && steps.length > 0 ? (
        <ol className="flex gap-1">
          {steps.map((step, index) => (
            <li key={step.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!onStep || step.disabled}
                onClick={() => onStep?.(step.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] transition",
                  step.status === "done" && "bg-podium-yellow/10 text-podium-white",
                  step.status === "current" && "bg-white/[0.06] text-podium-white",
                  step.status === "todo" && "text-podium-muted",
                  step.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    step.status === "done" && "bg-podium-yellow text-podium-navy",
                    step.status === "current" &&
                      "border border-podium-yellow/70 text-podium-yellow",
                    step.status === "todo" && "border border-white/15",
                  )}
                >
                  {step.status === "done" ? (
                    <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="truncate">{step.title}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      {children}
      {help ? (
        <details className="rounded-md border border-white/10 bg-black/20">
          <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-podium-white [&::-webkit-details-marker]:hidden">
            {COPY.automacoesHowItWorks}
          </summary>
          <div className="border-t border-white/10 px-3 py-3 text-sm text-podium-gray">
            {help}
          </div>
        </details>
      ) : null}
    </GlassCard>
  );
}
