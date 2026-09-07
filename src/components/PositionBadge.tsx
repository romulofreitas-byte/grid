import { scoreBand } from "@/lib/score-band";
import { cn } from "@/lib/utils";

export function PositionBadge({
  position,
  score,
  hasAudit = true,
  caption = true,
  size = "md",
  className,
}: {
  position: number;
  score: number;
  /** False = score is RF-only (fit + contactability), without dor digital. */
  hasAudit?: boolean;
  /** False = only the P chip (grid inline next to the company name). */
  caption?: boolean;
  size?: "md" | "sm";
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
          "inline-flex items-center justify-center font-bold tracking-wide",
          size === "sm"
            ? "rounded-md px-1.5 py-0.5 text-[10px]"
            : "rounded-lg px-2.5 py-1 text-xs",
          styles,
        )}
        title={
          hasAudit
            ? bandTitle
            : `${bandTitle} · só o cadastro da Receita — ainda sem site e redes`
        }
      >
        P{position}
      </span>
      {caption && !hasAudit ? (
        <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-podium-muted">
          Score — só cadastro
        </span>
      ) : null}
    </span>
  );
}
