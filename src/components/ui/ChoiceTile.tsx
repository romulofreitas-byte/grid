import { Check } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const DENSITY = {
  compact:
    "min-h-9 w-full items-center justify-center px-1 py-1.5 text-center text-xs font-medium",
  chip: "min-h-8 min-w-0 w-full items-center justify-center overflow-hidden px-2 py-1.5 text-center text-[11px] font-medium",
  row: "w-full items-start gap-3 px-3 py-2 text-left text-sm",
  card: "w-full items-start px-3 py-2.5 text-left text-sm",
} as const;

export type ChoiceTileDensity = keyof typeof DENSITY;

export function ChoiceTile({
  selected = false,
  density = "card",
  className,
  children,
  meta,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  density?: ChoiceTileDensity;
  /** Optional trailing / secondary line (row density). */
  meta?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        "inline-flex rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40 disabled:cursor-not-allowed disabled:opacity-40",
        DENSITY[density],
        selected
          ? "border-white/25 bg-white/[0.07] text-podium-white"
          : "border-white/10 bg-white/[0.03] text-podium-gray hover:border-white/20 hover:text-podium-white",
        className,
      )}
      {...props}
    >
      {density === "row" ? (
        <>
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              selected
                ? "border-podium-yellow/50 bg-podium-yellow/15 text-podium-yellow"
                : "border-white/20 text-transparent",
            )}
            aria-hidden
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block">{children}</span>
            {meta ? (
              <span className="mt-0.5 block text-xs text-podium-muted">{meta}</span>
            ) : null}
          </span>
        </>
      ) : density === "compact" || density === "chip" ? (
        <span className="inline-flex items-center justify-center gap-1">
          {selected ? (
            <Check
              className="h-3 w-3 shrink-0 text-podium-yellow"
              strokeWidth={3}
              aria-hidden
            />
          ) : null}
          {children}
        </span>
      ) : (
        <span className="flex w-full items-start justify-between gap-2">
          <span className="min-w-0 font-semibold text-podium-white">{children}</span>
          {selected ? (
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-podium-yellow"
              strokeWidth={3}
              aria-hidden
            />
          ) : null}
        </span>
      )}
    </button>
  );
}
