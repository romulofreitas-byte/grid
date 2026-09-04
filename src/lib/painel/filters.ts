import { z } from "zod";
import { PAINEL_RANGES, type PainelRange } from "@/lib/painel/types";

export { PAINEL_RANGES };
export type { PainelRange };

export const PAINEL_PIPELINE_STORAGE_KEY = "grid.painel.pipeline";
export const PAINEL_PIPELINE_ALL = "all";

export type PainelFilters = {
  range: PainelRange;
  pipelineId?: string;
};

export const DEFAULT_PAINEL_FILTERS: PainelFilters = { range: "30d" };

const rangeSchema = z.enum(PAINEL_RANGES);
const pipelineSchema = z.string().uuid();

function readParam(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  if (source instanceof URLSearchParams) {
    const value = source.get(key);
    return value?.trim() ? value.trim() : null;
  }
  const raw = source[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value.trim() : null;
}

export function parsePainelFilters(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): PainelFilters {
  const rangeParsed = rangeSchema.safeParse(readParam(source, "range") ?? "30d");
  const filters: PainelFilters = {
    range: rangeParsed.success ? rangeParsed.data : "30d",
  };
  const pipeline = pipelineSchema.safeParse(readParam(source, "pipeline"));
  if (pipeline.success) filters.pipelineId = pipeline.data;
  return filters;
}

export function painelFiltersQueryString(filters: PainelFilters): string {
  const params = new URLSearchParams();
  if (filters.range !== "30d") params.set("range", filters.range);
  if (filters.pipelineId) params.set("pipeline", filters.pipelineId);
  return params.toString();
}

export function painelRangeLabel(range: PainelRange): string {
  if (range === "today") return "Hoje";
  if (range === "7d") return "7 dias";
  if (range === "30d") return "30 dias";
  if (range === "month") return "Este mês";
  return "Tudo";
}
