import type { ListPerformance } from "@/lib/listas/performance";

export const LIST_VERDICT_KINDS = [
  "idle",
  "qualified_no_calls",
  "has_win",
  "has_win_elsewhere",
  "high_discard",
  "in_progress",
] as const;

export type ListVerdictKind = (typeof LIST_VERDICT_KINDS)[number];

export function listVerdict(
  stats: ListPerformance,
  opts?: { otherHasWin?: boolean },
): ListVerdictKind {
  if (stats.ganhos > 0) return "has_win";
  if (stats.qualified <= 0 && stats.called <= 0) return "idle";
  if (stats.qualified > 0 && stats.called <= 0) return "qualified_no_calls";

  const discardHeavy =
    stats.perdidos > 0 && stats.perdidos >= stats.em_acao + stats.ganhos;
  if (stats.called > 0 && discardHeavy) {
    return opts?.otherHasWin ? "has_win_elsewhere" : "high_discard";
  }
  if (opts?.otherHasWin && (stats.called > 0 || stats.perdidos > 0)) {
    return "has_win_elsewhere";
  }
  return "in_progress";
}
