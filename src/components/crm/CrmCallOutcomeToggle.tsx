"use client";

import { COPY } from "@/lib/copy";
import type { CallOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS = ["discagem", "decisor"] as const satisfies readonly CallOutcome[];

export function CrmCallOutcomeToggle({
  outcome,
  pending = false,
  onChange,
}: {
  outcome: CallOutcome;
  pending?: boolean;
  onChange: (outcome: CallOutcome) => void;
}) {
  return (
    <div role="group" aria-label={COPY.callOutcomeGroup} className="flex shrink-0 items-center gap-0.5">
      {OPTIONS.map((value) => {
        const active = outcome === value;
        const label =
          value === "decisor" ? COPY.callOutcomeDecisor : COPY.callOutcomeDiscagem;
        return (
          <button
            key={value}
            type="button"
            disabled={pending}
            aria-pressed={active}
            title={value === "decisor" ? COPY.callOutcomeDecisorTitle : label}
            onClick={() => {
              if (!active) onChange(value);
            }}
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] leading-none transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40",
              "disabled:opacity-50",
              active
                ? "bg-podium-yellow/15 font-medium text-podium-yellow"
                : "text-podium-muted hover:text-podium-gray",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
