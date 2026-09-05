"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/Button";
import { formatBrl, getCatalogItem } from "@/lib/billing/catalog";
import { planosHref } from "@/lib/billing/href";
import {
  ledgerReasonLabel,
  ledgerSign,
  orderStatusLabel,
  paymentMethodLabel,
} from "@/lib/billing/labels";
import { BILLING_ME_QUERY_KEY, useBillingMe } from "@/hooks/useBillingMe";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import {
  accountCredits,
  accountPeriodEnd,
  accountPlanName,
  formatAccountDate,
} from "@/lib/conta";
import { COPY } from "@/lib/copy";

export default function ContaPlanoPage() {
  const qc = useQueryClient();
  const profileQuery = useAccountProfile();
  const billingQuery = useBillingMe();
  const p = profileQuery.data;
  const billing = billingQuery.data;
  const periodEnd = accountPeriodEnd(billing);

  const cancel = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível cancelar");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLING_ME_QUERY_KEY }),
  });

  if (!p || billingQuery.isLoading) {
    return <div className="min-h-40 animate-pulse rounded-2xl bg-white/5" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="p-4 md:p-5" highlight hover={false}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
          Plano e cobrança
        </p>
        <p className="mt-2 text-2xl font-semibold text-podium-white">
          {accountPlanName(billing, p)}
        </p>
        <p className="mt-3 text-3xl font-semibold text-podium-yellow">
          {accountCredits(billing, p).toLocaleString("pt-BR")}
        </p>
        <p className="mt-1 text-sm text-podium-muted">
          {billing?.balance.plan ?? 0} do plano · {billing?.balance.pack ?? 0} de recarga
        </p>
        {periodEnd ? (
          <p className="mt-2 text-sm text-podium-gray">
            Vencimento: {formatAccountDate(periodEnd)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-podium-muted">Sem ciclo de cobrança vigente.</p>
        )}
        <Hint className="mt-2">{COPY.contaCreditHint}</Hint>
        <p className="mt-1 text-xs text-podium-muted">
          O crédito do plano zera no mês. Recarga fica e não reabre o CRM.
        </p>
        {billing?.balance.trialExpired ? (
          <p className="mt-2 text-xs text-podium-yellow">
            Os 30 dias acabaram. Assine o Piloto para continuar.
          </p>
        ) : billing?.subscription?.status === "trialing" &&
          billing.balance.trialDaysLeft != null ? (
          <p className="mt-2 text-xs text-podium-yellow">
            Restam {billing.balance.trialDaysLeft}{" "}
            {billing.balance.trialDaysLeft === 1 ? "dia" : "dias"} do trial.
          </p>
        ) : null}
        {billing?.subscription?.cancelAtPeriodEnd ? (
          <p className="mt-2 text-xs text-podium-yellow">Cancela no fim do ciclo.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={planosHref("/conta/plano")}
            className="inline-flex h-8 items-center rounded-md bg-podium-yellow px-3 text-xs font-semibold text-podium-navy"
          >
            Trocar plano / Recarregar
          </Link>
          {billing?.subscription &&
          billing.subscription.status === "active" &&
          !billing.subscription.cancelAtPeriodEnd ? (
            <Button
              type="button"
              size="md"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "Cancelando…" : "Cancelar no fim do ciclo"}
            </Button>
          ) : null}
        </div>
        {cancel.isError ? (
          <p className="mt-2 text-xs text-podium-alert">
            {cancel.error instanceof Error
              ? cancel.error.message
              : "Não foi possível cancelar"}
          </p>
        ) : null}
      </GlassCard>

      <GlassCard className="p-4 md:p-5" hover={false}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-podium-muted">
          {COPY.contaExtrato}
        </p>
        <p className="mt-1 text-xs text-podium-muted">O que entrou e saiu</p>
        <div className="mt-3 space-y-2">
          {(billing?.ledger ?? []).length === 0 ? (
            <p className="text-sm text-podium-muted">{COPY.contaExtratoEmpty}</p>
          ) : (
            (billing?.ledger ?? []).map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 text-sm text-podium-gray"
              >
                <span className="min-w-0">
                  <span className="block truncate">{ledgerReasonLabel(e.reason)}</span>
                  <span className="text-xs text-podium-muted">
                    {formatAccountDate(e.createdAt)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {ledgerSign(e.type)}
                  {e.amount}
                </span>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-4 md:p-5" hover={false}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-podium-muted">
          Faturas
        </p>
        <div className="mt-3 space-y-2">
          {(billing?.orders ?? []).length === 0 ? (
            <p className="text-sm text-podium-muted">Nenhuma fatura ainda.</p>
          ) : (
            (billing?.orders ?? []).map((o) => {
              const item = getCatalogItem(o.sku);
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 text-sm text-podium-gray"
                >
                  <span>
                    {item?.nome ?? o.sku} · {paymentMethodLabel(o.method)}
                  </span>
                  <span>
                    {formatBrl(o.amountCents)} · {orderStatusLabel(o.status)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>
    </div>
  );
}
