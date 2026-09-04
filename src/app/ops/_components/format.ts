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

export function formatPct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

export function debitReasonLabel(reason: string): string {
  if (reason === "enrich") return "Qualificação";
  if (reason === "export") return "Export";
  return "Outros";
}

export function orderKindLabel(kind: string): string {
  if (kind === "subscription_cycle") return "Mensalidade";
  if (kind === "credit_pack") return "Recarga";
  if (kind === "platform") return "Plataforma";
  return kind;
}

export function lotSourceLabel(source: string): string {
  if (source === "plan_grant") return "Plano";
  if (source === "pack") return "Recarga";
  if (source === "platform") return "Plataforma";
  if (source === "manual") return "Manual";
  return source;
}

export function jobStatusLabel(status: string): string {
  if (status === "pending") return "Fila";
  if (status === "running") return "Rodando";
  if (status === "done") return "Feito";
  if (status === "failed") return "Falhou";
  if (status === "skipped") return "Pulado";
  return status;
}

export { formatBrl };
