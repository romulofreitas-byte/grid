import { z } from "zod";
import type { OpsCohort } from "@/lib/ops/classify";

export const OPS_RANGES = ["7d", "30d", "90d", "month", "all"] as const;
export type OpsRange = (typeof OPS_RANGES)[number];

export const OPS_USERS_PAGE_SIZE = 50;

export const BRAZIL_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type BrazilUf = (typeof BRAZIL_UFS)[number];

export type OpsDashboardFilters = {
  range: OpsRange;
  cohort?: OpsCohort;
  plan?: string;
  uf?: string;
  nicheId?: string;
  recharged?: boolean;
};

export type OpsFilterDimension = "cohort" | "plan" | "uf" | "nicheId" | "recharged";

export const DEFAULT_OPS_FILTERS: OpsDashboardFilters = { range: "30d" };

const rangeSchema = z.enum(OPS_RANGES);
const cohortSchema = z.enum(["active", "trial", "free"]);
const ufSchema = z.enum(BRAZIL_UFS);
const planSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{1,40}$/i);
const nicheSchema = z.string().uuid();
const boolParam = z
  .enum(["1", "0", "true", "false"])
  .transform((value) => value === "1" || value === "true");

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

export function parseOpsDashboardFilters(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): OpsDashboardFilters {
  const rangeParsed = rangeSchema.safeParse(readParam(source, "range") ?? "30d");
  const filters: OpsDashboardFilters = {
    range: rangeParsed.success ? rangeParsed.data : "30d",
  };

  const cohort = cohortSchema.safeParse(readParam(source, "cohort"));
  if (cohort.success) filters.cohort = cohort.data;

  const plan = planSchema.safeParse(readParam(source, "plan"));
  if (plan.success) filters.plan = plan.data.toLowerCase();

  const uf = ufSchema.safeParse(readParam(source, "uf")?.toUpperCase());
  if (uf.success) filters.uf = uf.data;

  const niche = nicheSchema.safeParse(readParam(source, "niche"));
  if (niche.success) filters.nicheId = niche.data;

  const recharged = boolParam.safeParse(readParam(source, "recharged"));
  if (recharged.success) filters.recharged = recharged.data;

  return filters;
}

export function parseOpsUserListParams(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): {
  filters: OpsDashboardFilters;
  q: string;
  limit: number;
  offset: number;
} {
  const filters = parseOpsDashboardFilters(source);
  const q = (readParam(source, "q") ?? "").slice(0, 120);
  const limitRaw = Number(readParam(source, "limit") ?? OPS_USERS_PAGE_SIZE);
  const offsetRaw = Number(readParam(source, "offset") ?? 0);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.floor(limitRaw)))
    : OPS_USERS_PAGE_SIZE;
  const offset = Number.isFinite(offsetRaw)
    ? Math.min(100_000, Math.max(0, Math.floor(offsetRaw)))
    : 0;
  return { filters, q, limit, offset };
}

export function opsFiltersToSearchParams(
  filters: OpsDashboardFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.range !== "30d") params.set("range", filters.range);
  if (filters.cohort) params.set("cohort", filters.cohort);
  if (filters.plan) params.set("plan", filters.plan);
  if (filters.uf) params.set("uf", filters.uf);
  if (filters.nicheId) params.set("niche", filters.nicheId);
  if (filters.recharged === true) params.set("recharged", "1");
  if (filters.recharged === false) params.set("recharged", "0");
  return params;
}

export function opsFiltersQueryString(filters: OpsDashboardFilters): string {
  return opsFiltersToSearchParams(filters).toString();
}

export function withOpsRange(
  current: OpsDashboardFilters,
  range: OpsRange,
): OpsDashboardFilters {
  return { ...current, range };
}

export function toggleOpsDimension(
  current: OpsDashboardFilters,
  key: OpsFilterDimension,
  value: string | boolean,
): OpsDashboardFilters {
  const next: OpsDashboardFilters = { ...current };
  if (key === "recharged") {
    const bool = value === true || value === "1" || value === "true";
    if (next.recharged === bool) delete next.recharged;
    else next.recharged = bool;
    return next;
  }
  const str = String(value);
  if (next[key] === str) {
    delete next[key];
    return next;
  }
  if (key === "cohort" && (str === "active" || str === "trial" || str === "free")) {
    next.cohort = str;
    return next;
  }
  if (key === "plan") next.plan = str;
  else if (key === "uf") next.uf = str;
  else if (key === "nicheId") next.nicheId = str;
  return next;
}

export function clearOpsDimensions(
  current: OpsDashboardFilters,
): OpsDashboardFilters {
  return { range: current.range };
}

export function opsRangeLabel(range: OpsRange): string {
  if (range === "7d") return "7 dias";
  if (range === "30d") return "30 dias";
  if (range === "90d") return "90 dias";
  if (range === "month") return "Este mês";
  return "Tudo";
}

export function hasOpsDimension(filters: OpsDashboardFilters): boolean {
  return Boolean(
    filters.cohort ||
      filters.plan ||
      filters.uf ||
      filters.nicheId ||
      filters.recharged !== undefined,
  );
}
