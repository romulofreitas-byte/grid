"use client";

import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import { COPY } from "@/lib/copy";
import { displayName } from "@/lib/pilot-profile";
import { supportWhatsAppHref } from "@/lib/support";

export default function ContaAjudaPage() {
  const profileQuery = useAccountProfile();
  const p = profileQuery.data;
  const hasWhatsApp = Boolean(supportWhatsAppHref({ pathname: "/conta/ajuda" }));

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3 p-4 md:p-5" hover={false}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
          Atendimento
        </p>
        <p className="text-sm text-podium-gray">{COPY.contaWhatsApp24h}</p>
        {hasWhatsApp ? (
          <SupportWhatsAppButton
            name={p ? displayName(p) : null}
            pathname="/conta/ajuda"
          />
        ) : (
          <Hint>O WhatsApp de atendimento não está configurado neste ambiente.</Hint>
        )}
      </GlassCard>

      <GlassCard className="space-y-3 p-4 md:p-5" hover={false}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
          Dúvidas
        </p>
        <p className="text-sm text-podium-gray">
          Respostas rápidas sobre lista, créditos, exportação e privacidade.
        </p>
        <Link
          href="/duvidas"
          className="inline-flex rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
        >
          Abrir dúvidas
        </Link>
      </GlassCard>

      <GlassCard className="space-y-3 p-4 md:p-5" hover={false}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted">
          Tour
        </p>
        <p className="text-sm text-podium-gray">{COPY.tourReplayHint}</p>
        <Link
          href="/painel?tour=1"
          className="inline-flex rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
        >
          {COPY.tourReplay}
        </Link>
      </GlassCard>
    </div>
  );
}
