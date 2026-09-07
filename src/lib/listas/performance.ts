import { CHART } from "@/components/charts/chartTheme";
import type { LeadStatus } from "@/lib/types";

export const LIST_SLICES = ["parados", "em_acao", "ganhos", "perdidos"] as const;
export type ListSliceId = (typeof LIST_SLICES)[number];

export const LIST_RECORTES = [
  ...LIST_SLICES,
  "qualificadas",
  "ligacoes",
] as const;
export type ListRecorte = (typeof LIST_RECORTES)[number];

export const GRID_RECORTES = [...LIST_RECORTES, "cadastro"] as const;
export type GridRecorte = (typeof GRID_RECORTES)[number];

export type ListLeadFlags = {
  status: LeadStatus;
  crmOutcome: "won" | "lost" | "open" | null;
  qualified: boolean;
  called: boolean;
};

export type ListPerformance = {
  searchId: string;
  total: number;
  parados: number;
  em_acao: number;
  ganhos: number;
  perdidos: number;
  qualified: number;
  called: number;
};

export const LIST_SLICE_FILL: Record<ListSliceId, string> = {
  parados: CHART.none,
  em_acao: CHART.calls,
  ganhos: CHART.won,
  perdidos: CHART.lost,
};

export function emptyListPerformance(searchId: string): ListPerformance {
  return {
    searchId,
    total: 0,
    parados: 0,
    em_acao: 0,
    ganhos: 0,
    perdidos: 0,
    qualified: 0,
    called: 0,
  };
}

export function classifyLeadSlice(lead: {
  status: LeadStatus;
  crmOutcome: "won" | "lost" | "open" | null;
}): ListSliceId {
  if (lead.crmOutcome === "won") return "ganhos";
  if (lead.status === "descartado" || lead.crmOutcome === "lost") {
    return "perdidos";
  }
  if (lead.status === "ligando" || lead.status === "reuniao") return "em_acao";
  return "parados";
}

export function partitionLeads(
  leads: Array<{ status: LeadStatus; crmOutcome: "won" | "lost" | "open" | null }>,
): Pick<ListPerformance, ListSliceId> {
  const partition = { parados: 0, em_acao: 0, ganhos: 0, perdidos: 0 };
  for (const lead of leads) {
    partition[classifyLeadSlice(lead)] += 1;
  }
  return partition;
}

export function performanceFromLeads(
  searchId: string,
  leads: ListLeadFlags[],
): ListPerformance {
  const partition = partitionLeads(leads);
  return {
    searchId,
    total: leads.length,
    ...partition,
    qualified: leads.filter((lead) => lead.qualified).length,
    called: leads.filter((lead) => lead.called).length,
  };
}

export function pctOf(part: number, total: number): number {
  if (total <= 0 || part <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function leadMatchesRecorte(
  recorte: GridRecorte,
  lead: ListLeadFlags,
): boolean {
  if (recorte === "qualificadas") return lead.qualified;
  if (recorte === "cadastro") return !lead.qualified;
  if (recorte === "ligacoes") return lead.called;
  return classifyLeadSlice(lead) === recorte;
}

export function parseGridRecorte(value: string | null | undefined): GridRecorte | null {
  if (!value) return null;
  return (GRID_RECORTES as readonly string[]).includes(value)
    ? (value as GridRecorte)
    : null;
}

export function parseListRecorte(value: string | null | undefined): ListRecorte | null {
  if (!value) return null;
  return (LIST_RECORTES as readonly string[]).includes(value)
    ? (value as ListRecorte)
    : null;
}

export type GridRowFilter = "all" | GridRecorte;

export function parseGridRowFilter(value: string | null | undefined): GridRowFilter {
  if (!value || value === "all") return "all";
  if (value === "qualified") return "qualificadas";
  return parseGridRecorte(value) ?? "all";
}

export function indexListPerformance(
  rows: ListPerformance[],
  searchIds: string[],
): Record<string, ListPerformance> {
  const byId = new Map(rows.map((row) => [row.searchId, row]));
  return Object.fromEntries(
    searchIds.map((id) => [id, byId.get(id) ?? emptyListPerformance(id)]),
  );
}
