"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { PilotAvatar } from "@/components/PilotAvatar";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { buttonClassName } from "@/components/ui/Button";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import { COPY } from "@/lib/copy";
import { LIVE_STATS_QUERY_OPTIONS } from "@/lib/live-stats";
import { displayName } from "@/lib/pilot-profile";
import { supportWhatsAppHref } from "@/lib/support";
import type { PainelMetrics } from "@/lib/painel/types";

export default function ContaEquipePage() {
  const profileQuery = useAccountProfile();
  const p = profileQuery.data;
  const metricsQuery = useQuery({
    queryKey: ["painel-metrics", "equipe", "7d"],
    queryFn: async () => {
      const res = await fetch("/api/painel/metrics?range=7d");
      if (!res.ok) throw new Error("metrics");
      return (await res.json()) as PainelMetrics;
    },
    ...LIVE_STATS_QUERY_OPTIONS,
  });
  const m = metricsQuery.data;
  const hasWaitlist = Boolean(
    supportWhatsAppHref({ pathname: "/conta/equipe", intent: "equipe" }),
  );
  const callsWeek = (m?.habit ?? []).reduce((sum, day) => sum + day.calls, 0);

  return (
    <div className="space-y-3">
      <GlassCard className="space-y-3 p-3" hover={false}>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          {COPY.equipeTitle}
        </p>
        <p className="text-sm text-podium-gray">{COPY.equipeLead}</p>
        {hasWaitlist ? (
          <SupportWhatsAppButton pathname="/conta/equipe" intent="equipe">
            {COPY.equipeCtaWaitlist}
          </SupportWhatsAppButton>
        ) : (
          <Hint>O WhatsApp de atendimento não está configurado neste ambiente.</Hint>
        )}
      </GlassCard>

      <GlassCard className="flex items-center gap-3 p-3" hover={false}>
        {p ? (
          <PilotAvatar profile={p} size="md" shape="squircle" />
        ) : (
          <div className="h-14 w-14 animate-pulse rounded-lg bg-white/10" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-podium-white">
            {p ? displayName(p) : "…"}
          </p>
          <p className="text-sm text-podium-muted">{COPY.equipePhotoHint}</p>
        </div>
        <Link
          href="/conta/perfil"
          className={buttonClassName({ variant: "secondary", size: "md" })}
        >
          {COPY.equipeOpenProfile}
        </Link>
      </GlassCard>

      <div className="grid gap-3 sm:grid-cols-2">
        <GlassCard className="p-3" hover={false}>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
            {COPY.equipeCallsWeek}
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {m ? callsWeek.toLocaleString("pt-BR") : "—"}
          </p>
        </GlassCard>
        <GlassCard className="p-3" hover={false}>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
            {COPY.equipeWonWeek}
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {m ? m.kpis.wonPeriod.toLocaleString("pt-BR") : "—"}
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
