import { formatInt } from "@/components/charts/chartTheme";
import { formatBrl } from "@/lib/billing/catalog";

export type AnimatedNumberFormat = "int" | "brl" | "pct";

export const ANIMATED_NUMBER_DURATION_S = 0.7;

export function formatAnimatedNumber(
  value: number,
  format: AnimatedNumberFormat,
): string {
  const rounded = Math.round(value);
  if (format === "brl") return formatBrl(rounded);
  if (format === "pct") return `${rounded}%`;
  return formatInt(rounded);
}

/** Where the tween starts: 0 on first paint, previous value after that, target if motion is reduced. */
export function animatedNumberTweenFrom(
  previous: number | null,
  target: number,
  reduceMotion: boolean,
): number {
  if (reduceMotion) return target;
  if (previous == null) return 0;
  return previous;
}
