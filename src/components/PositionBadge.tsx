import { scoreBand } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export function PositionBadge({
  position,
  score,
  className,
}: {
  position: number;
  score: number;
  className?: string;
}) {
  const band = scoreBand(score);
  const styles =
    band === "POLE"
      ? "bg-podium-yellow text-podium-navy"
      : band === "FRENTE"
        ? "bg-podium-yellow/20 text-podium-yellow"
        : band === "MEIO"
          ? "bg-white/10 text-podium-gray"
          : "border border-white/20 text-podium-muted bg-transparent";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold tracking-wide",
        styles,
        className,
      )}
      title={
        band === "POLE"
          ? "Prioridade alta — ligar primeiro"
          : band === "FRENTE"
            ? "Prioridade alta"
            : band === "MEIO"
              ? "Prioridade média"
              : "Prioridade baixa"
      }
    >
      P{position}
    </span>
  );
}
