import { cn } from "@/lib/utils";

export type LightsPhase = "idle" | "lighting" | "out" | "go" | "hold";
export type LightsSize = "default" | "compact" | "micro";

const SIZE = {
  default: {
    gap: "gap-2.5",
    dot: "h-3.5 w-3.5 md:h-4 md:w-4",
    yellowGlow: "shadow-[0_0_18px_rgba(245,179,1,0.85)]",
    redGlow: "shadow-[0_0_16px_rgba(239,68,68,0.75)]",
  },
  compact: {
    gap: "gap-1.5",
    dot: "h-2.5 w-2.5 md:h-3 md:w-3",
    yellowGlow: "shadow-[0_0_18px_rgba(245,179,1,0.85)]",
    redGlow: "shadow-[0_0_16px_rgba(239,68,68,0.75)]",
  },
  micro: {
    gap: "gap-1",
    dot: "h-1.5 w-1.5",
    yellowGlow: "shadow-[0_0_5px_rgba(245,179,1,0.4)]",
    redGlow: "shadow-[0_0_4px_rgba(239,68,68,0.35)]",
  },
} as const;

export function StartingLights({
  litCount,
  phase,
  className,
  compact,
  size,
}: {
  litCount: number;
  phase: LightsPhase;
  className?: string;
  compact?: boolean;
  size?: LightsSize;
}) {
  const yellow = phase === "go" || phase === "hold";
  const resolved = SIZE[size ?? (compact ? "compact" : "default")];

  return (
    <div
      className={cn("flex items-center", resolved.gap, className)}
      aria-hidden
    >
      {Array.from({ length: 5 }, (_, i) => {
        const lit =
          phase === "go" ? true : phase === "out" ? false : i < litCount;
        return (
          <span
            key={i}
            className={cn(
              "rounded-full border border-white/15 transition-all duration-150",
              resolved.dot,
              yellow && lit
                ? cn("border-podium-yellow/40 bg-podium-yellow", resolved.yellowGlow)
                : lit
                  ? cn("border-red-400/40 bg-red-500", resolved.redGlow)
                  : "bg-white/10",
            )}
          />
        );
      })}
    </div>
  );
}
