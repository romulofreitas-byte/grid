import { formatBrl, getCatalogItem } from "@/lib/billing/catalog";
import type { OpsCohort } from "@/lib/ops/classify";

export function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

export function planLabel(sku: string | null | undefined): string {
  if (!sku) return "—";
  return getCatalogItem(sku)?.nome ?? sku;
}

export function cohortLabel(cohort: OpsCohort): string {
  if (cohort === "active") return "Ativo";
  if (cohort === "trial") return "Trial";
  return "Treino livre";
}

export { formatBrl };
