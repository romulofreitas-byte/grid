"use client";

import type { ReactNode } from "react";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function FocusSwitch({
  on,
  onToggle,
  children,
  className,
}: {
  on: boolean;
  onToggle: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? COPY.focusExit : COPY.focusEnter}
      title={on ? COPY.focusExit : COPY.focusEnter}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2 py-2 outline-none",
        "transition-colors duration-200 hover:bg-white/5",
        "focus-visible:ring-2 focus-visible:ring-podium-yellow ring-offset-2 ring-offset-podium-navy",
        className,
      )}
    >
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-[0.14em]",
          on ? "text-podium-yellow" : "text-podium-muted",
        )}
      >
        {COPY.focusBadgeEyebrow}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200",
          on ? "bg-podium-yellow" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200",
            on && "translate-x-3",
          )}
        />
      </span>
      {children}
    </button>
  );
}
