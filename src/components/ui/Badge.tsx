import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANT = {
  neutral: "border-white/10 bg-white/5 text-podium-gray",
  accent: "border-podium-yellow/25 bg-podium-yellow/10 text-podium-yellow",
  success: "border-podium-success/30 bg-podium-success/10 text-podium-success",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-300",
} as const;

export type BadgeVariant = keyof typeof VARIANT;

export function Badge({
  className,
  variant = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-lg border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}
