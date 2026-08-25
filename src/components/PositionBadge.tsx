import { scoreBand } from "@/lib/score-band";
import { cn } from "@/lib/utils";

export function PositionBadge({
  position,
  score,
  hasAudit = true,
  className,
}: {
  position: number;
  score: number;
  /** False = score is RF-only (fit + contactability), without dor digital. */
  hasAudit?: boolean;
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

  const bandTitle =
    band === "POLE"
      ? "Prioridade alta — ligar primeiro"
      : band === "FRENTE"
        ? "Prioridade alta"
        : band === "MEIO"
          ? "Prioridade média"
          : "Prioridade baixa";

  return (
    <span
      className={cn(
        "inline-flex flex-col items-start gap-0.5",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold tracking-wide",
          styles,
        )}
        title={
          hasAudit
            ? bandTitle
            : `${bandTitle} · score seco (só Receita — sem auditoria digital)`
        }
      >
        P{position}
      </span>
      {!hasAudit ? (
        <span className="text-[10px] font-medium uppercase tracking-wide text-podium-muted">
          Score seco
        </span>
      ) : null}
    </span>
  );
}
