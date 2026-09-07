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
    <div className="space-y-3">
      <GlassCard className="space-y-3 p-3" hover={false}>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
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

      <GlassCard className="space-y-3 p-3" hover={false}>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          Dúvidas
        </p>
        <p className="text-sm text-podium-gray">{COPY.contaAjudaFaqHint}</p>
        <Link
          href="/duvidas"
          className="inline-flex rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
        >
          {COPY.contaAjudaOpenFaq}
        </Link>
      </GlassCard>

      <GlassCard className="space-y-3 p-3" hover={false}>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          Tour
        </p>
        <p className="text-sm text-podium-gray">{COPY.tourReplayHint}</p>
        <Link
          href="/painel?tour=1"
          className="inline-flex rounded-md bg-gradient-to-b from-[#ffc933] to-podium-yellow px-3 py-1.5 text-xs font-semibold text-podium-navy hover:brightness-110"
        >
          {COPY.tourReplay}
        </Link>
      </GlassCard>
    </div>
  );
}
