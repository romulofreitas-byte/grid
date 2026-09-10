import {
  type PlanBadgeTone,
} from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";

export const BADGE_TONE: Record<PlanBadgeTone, string> = {
  yellow:
    "border-podium-yellow/40 bg-podium-yellow/15 text-podium-yellow",
  muted: "border-white/15 bg-white/[0.04] text-podium-gray",
  success: "border-podium-success/35 bg-podium-success/15 text-podium-success",
  sky: "border-sky-400/35 bg-sky-400/15 text-sky-300",
};

export function PlanPill({
  label,
  tone,
  className,
}: {
  label: string;
  tone: PlanBadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none",
        BADGE_TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
