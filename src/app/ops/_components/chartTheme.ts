export const OPS_CHART = {
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
  grid: "rgba(255,255,255,0.08)",
  tick: "#94a3b8",
  tooltipBg: "#12141c",
  tooltipBorder: "rgba(255,255,255,0.12)",
} as const;

export const OPS_COHORT_COLORS = {
  active: OPS_CHART.active,
  trial: OPS_CHART.trial,
  free: OPS_CHART.free,
} as const;

export const tooltipStyle = {
  backgroundColor: OPS_CHART.tooltipBg,
  border: `1px solid ${OPS_CHART.tooltipBorder}`,
  borderRadius: 12,
  fontSize: 12,
  color: "#f8fafc",
};

export function shortDay(iso: string): string {
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}
