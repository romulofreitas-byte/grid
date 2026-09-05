"use client";

import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import { useBillingMe } from "@/hooks/useBillingMe";
import { useConnections } from "@/hooks/useConnections";
import {
  accountCredits,
  accountPeriodEnd,
  accountPlanName,
  formatAccountDate,
} from "@/lib/conta";
import { COPY } from "@/lib/copy";
import { displayName, profileIdentityStatus } from "@/lib/pilot-profile";

export default function ContaResumoPage() {
  const profileQuery = useAccountProfile();
  const billingQuery = useBillingMe();
  const connectionsQuery = useConnections();

  const p = profileQuery.data;
  const billing = billingQuery.data;
  const connections = connectionsQuery.data ?? [];
  const periodEnd = accountPeriodEnd(billing);
  const activeConnections = connections.filter((c) => c.status === "active");

  if (!p || billingQuery.isLoading) {
    return <div className="min-h-40 animate-pulse rounded-2xl bg-white/5" />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link href="/conta/perfil" className="block">
        <GlassCard className="h-full p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
            Perfil
          </p>
          <p className="mt-2 text-lg font-semibold text-podium-white">
            {displayName(p)}
          </p>
          <p className="mt-1 text-sm text-podium-muted">
            {profileIdentityStatus(p)}
          </p>
        </GlassCard>
      </Link>

      <Link href="/conta/acesso" className="block">
        <GlassCard className="h-full p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
            Acesso
          </p>
          <p className="mt-2 truncate text-lg font-semibold text-podium-white">
            {p.email?.trim() || "E-mail da conta"}
          </p>
          <p className="mt-1 text-sm text-podium-muted">Senha e e-mail de entrada.</p>
        </GlassCard>
      </Link>

      <Link href="/conta/plano" className="block">
        <GlassCard className="h-full p-4" highlight>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
            Plano e cobrança
          </p>
          <p className="mt-2 text-lg font-semibold text-podium-white">
            {accountPlanName(billing, p)}
          </p>
          <p className="mt-1 text-sm text-podium-muted">
            {accountCredits(billing, p).toLocaleString("pt-BR")} créditos
            {periodEnd ? ` · vence ${formatAccountDate(periodEnd)}` : ""}
          </p>
        </GlassCard>
      </Link>

      <Link href="/conta/conexoes" className="block">
        <GlassCard className="h-full p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
            Conexões
          </p>
          <p className="mt-2 text-lg font-semibold text-podium-white">
            {activeConnections.length === 0
              ? "Nenhuma conexão ativa"
              : activeConnections.length === 1
                ? "1 conexão ativa"
                : `${activeConnections.length} conexões ativas`}
          </p>
          <p className="mt-1 text-sm text-podium-muted">
            VoIP, discador, importações e automações.
          </p>
        </GlassCard>
      </Link>

      <Link href="/conta/ajuda" className="block sm:col-span-2">
        <GlassCard className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
            Ajuda
          </p>
          <p className="mt-2 text-sm text-podium-gray">{COPY.contaWhatsApp24h}</p>
        </GlassCard>
      </Link>
    </div>
  );
}
