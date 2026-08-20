import { cn } from "@/lib/utils";

export function VoltaRing({
  hoje,
  meta,
  muted = false,
  size = "md",
  className,
}: {
  hoje: number;
  meta: number;
  muted?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const pct = meta > 0 ? Math.min(1, hoje / meta) : 0;
  const large = size === "lg";
  return (
    <div className={cn("relative", large ? "h-28 w-28 md:h-36 md:w-36" : "h-28 w-28", className)}>
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={large ? 7 : 8}
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={muted ? "rgba(255,255,255,0.22)" : "#F5B301"}
          strokeWidth={large ? 7 : 8}
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p
          className={cn(
            "font-extrabold leading-none",
            large ? "text-xl md:text-2xl" : "text-xl",
            muted ? "text-podium-muted" : "text-podium-white",
          )}
        >
          {hoje}/{meta}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-podium-muted">
          hoje
        </p>
      </div>
    </div>
  );
}
