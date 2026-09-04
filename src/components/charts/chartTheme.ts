export const CHART = {
  active: "#f5b301",
  trial: "#7dd3fc",
  free: "#64748b",
  enrich: "#f5b301",
  export: "#fb923c",
  other: "#94a3b8",
  subscription: "#f5b301",
  pack: "#34d399",
  platform: "#c4b5fd",
  searches: "#7dd3fc",
  calls: "#f472b6",
  won: "#34d399",
  lost: "#f87171",
  overdue: "#f87171",
  today: "#f5b301",
  scheduled: "#7dd3fc",
  none: "#64748b",
  meta: "rgba(255,255,255,0.35)",
  grid: "rgba(255,255,255,0.08)",
  tick: "#94a3b8",
  tooltipBg: "#12141c",
  tooltipBorder: "rgba(255,255,255,0.12)",
} as const;

/** @deprecated Use CHART. Kept for ops imports. */
export const OPS_CHART = CHART;

export const OPS_COHORT_COLORS = {
  active: CHART.active,
  trial: CHART.trial,
  free: CHART.free,
} as const;

export const tooltipStyle = {
  backgroundColor: CHART.tooltipBg,
  border: `1px solid ${CHART.tooltipBorder}`,
  borderRadius: 12,
  fontSize: 12,
  color: "#f8fafc",
};

export function shortDay(iso: string): string {
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

/** Share of the track. Do not add a floor — 28 must stay shorter than 30. */
export function proportionalWidthPct(count: number, max: number): number {
  if (max <= 0) return 0;
  return (count / max) * 100;
}
