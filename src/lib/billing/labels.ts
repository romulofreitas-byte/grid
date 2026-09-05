import type { PaymentMethod } from "@/lib/billing/catalog";
import type { LedgerType, OrderStatus } from "@/lib/billing/types";

export function ledgerReasonLabel(reason: string): string {
  if (reason === "enrich") return "Qualificação";
  if (reason === "export") return "Exportação";
  if (reason === "grant_free_period") return "Treino livre";
  if (reason === "plan_renew_reset") return "Créditos do plano zeraram no mês";
  if (reason === "ops_grant" || reason === "ops_revoke") return "Ajuste da conta";
  if (reason.startsWith("pack_")) return "Recarga";
  if (reason.startsWith("plan_renew_") || reason.startsWith("plan_")) {
    return "Créditos do plano";
  }
  return "Movimento";
}

export function orderStatusLabel(status: OrderStatus | string): string {
  if (status === "paid") return "Paga";
  if (status === "pending") return "Pendente";
  if (status === "expired") return "Expirada";
  if (status === "failed") return "Falhou";
  if (status === "refunded") return "Estornada";
  return status;
}

export function paymentMethodLabel(method: PaymentMethod | "platform" | string): string {
  if (method === "pix") return "Pix";
  if (method === "card_br") return "Cartão";
  if (method === "boleto") return "Boleto";
  if (method === "card_intl") return "Cartão internacional";
  if (method === "platform") return "Plataforma";
  return method;
}

export function ledgerSign(type: LedgerType): "+" | "−" | "" {
  if (type === "debit" || type === "expire") return "−";
  if (type === "grant" || type === "refund") return "+";
  return "";
}
