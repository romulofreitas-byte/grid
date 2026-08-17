import { cn } from "@/lib/utils";

export type LightsPhase = "idle" | "lighting" | "out" | "go" | "hold";

export function StartingLights({
  litCount,
  phase,
  className,
  compact,
}: {
  litCount: number;
  phase: LightsPhase;
  className?: string;
  compact?: boolean;
}) {
  const yellow = phase === "go" || phase === "hold";

  return (
    <div
      className={cn("flex items-center", compact ? "gap-1.5" : "gap-2.5", className)}
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
              compact
                ? "h-2.5 w-2.5 md:h-3 md:w-3"
                : "h-3.5 w-3.5 md:h-4 md:w-4",
              yellow && lit
                ? "border-podium-yellow/40 bg-podium-yellow shadow-[0_0_18px_rgba(245,179,1,0.85)]"
                : lit
                  ? "border-red-400/40 bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.75)]"
                  : "bg-white/10",
            )}
          />
        );
      })}
    </div>
  );
}
