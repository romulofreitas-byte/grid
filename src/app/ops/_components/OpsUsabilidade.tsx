"use client";

import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import { OpsChartCard } from "@/app/ops/_components/OpsChartCard";
import { OpsFunnelBars } from "@/app/ops/_components/OpsCharts";
import { formatInt, formatPct } from "@/app/ops/_components/format";
import type { OpsMetrics } from "@/lib/ops/types";

function Drop({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <GlassCard className="p-3" hover={false}>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      <Hint className="mt-1">{hint}</Hint>
    </GlassCard>
  );
}

export function OpsUsabilidade({ metrics }: { metrics: OpsMetrics | undefined }) {
  const steps = metrics?.funnel.steps ?? [];
  const signed = steps.find((s) => s.id === "signed_up")?.count ?? 0;
  const activated = steps.find((s) => s.id === "activated")?.count ?? 0;
  const searched = steps.find((s) => s.id === "searched")?.count ?? 0;
  const qualified = steps.find((s) => s.id === "qualified")?.count ?? 0;
  const paid = steps.find((s) => s.id === "paid")?.count ?? 0;
  const stuckSetup = Math.max(0, signed - activated);
  const stuckSearch = Math.max(0, activated - searched);
  const stuckQualify = Math.max(0, searched - qualified);
  const stuckPay = Math.max(0, qualified - paid);

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Usabilidade</SectionTitle>
        <Hint className="mt-1">
          Onde o piloto parou depois do cadastro. Use a fila para ligar, treinar
          ou dar crédito — não é o funil de marketing, é intervenção.
        </Hint>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Drop
          label="Setup incompleto"
          value={metrics ? formatInt(stuckSetup) : "—"}
          hint={`${formatPct(stuckSetup, signed)} dos cadastros no período`}
        />
        <Drop
          label="Ativou e não buscou"
          value={metrics ? formatInt(stuckSearch) : "—"}
          hint="Concluiu o setup e não gerou lista"
        />
        <Drop
          label="Buscou e não qualificou"
          value={metrics ? formatInt(stuckQualify) : "—"}
          hint="Viu a lista e não gastou crédito"
        />
        <Drop
          label="Qualificou e não pagou"
          value={metrics ? formatInt(stuckPay) : "—"}
          hint="Usou o treino e não assinou"
        />
      </div>
      <OpsChartCard
        title="Funil de quem cadastrou no período"
        hint={
          metrics
            ? `${formatInt(metrics.funnel.recharged)} destes recarregaram.`
            : undefined
        }
      >
        <OpsFunnelBars steps={steps} />
      </OpsChartCard>
    </div>
  );
}
