"use client";

import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import { OpsChartCard } from "@/app/ops/_components/OpsChartCard";
import {
  OpsDonut,
  OpsFunnelBars,
  OpsHBar,
  OpsLines,
  OpsStackedArea,
} from "@/app/ops/_components/OpsCharts";
import { OpsFilterBar } from "@/app/ops/_components/OpsFilterBar";
import { OpsUsersTable } from "@/app/ops/_components/OpsUsersTable";
import {
  OPS_CHART,
  OPS_COHORT_COLORS,
} from "@/app/ops/_components/chartTheme";
import {
  cohortLabel,
  debitReasonLabel,
  formatBrl,
  formatInt,
  formatPct,
  jobStatusLabel,
  lotSourceLabel,
  orderKindLabel,
  planLabel,
} from "@/app/ops/_components/format";
import type { OpsCohort } from "@/lib/ops/classify";
import {
  opsFiltersQueryString,
  parseOpsDashboardFilters,
  toggleOpsDimension,
  type OpsDashboardFilters,
  type OpsFilterDimension,
} from "@/lib/ops/filters";
import type { OpsMetrics, OpsUserListPage } from "@/lib/ops/types";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (res.status === 401) {
    throw Object.assign(new Error("auth"), { code: "auth" });
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Falha ao carregar");
  }
  return data;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <GlassCard className="p-4" hover={false}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-podium-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
      {hint ? <Hint className="mt-1">{hint}</Hint> : null}
    </GlassCard>
  );
}

function Heatmap({
  cells,
  onCell,
  activeNiche,
  activeUf,
}: {
  cells: OpsMetrics["nicheUf"];
  onCell: (nicheId: string, uf: string) => void;
  activeNiche?: string;
  activeUf?: string;
}) {
  if (cells.length === 0) {
    return <p className="py-8 text-center text-sm text-podium-muted">Nada neste recorte.</p>;
  }
  const max = Math.max(...cells.map((cell) => cell.count), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-podium-muted">
          <tr>
            <th className="px-2 py-1.5 font-bold">Nicho</th>
            <th className="px-2 py-1.5 font-bold">UF</th>
            <th className="px-2 py-1.5 font-bold">Buscas</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => {
            const on =
              activeNiche === cell.nicheId && activeUf === cell.uf;
            const opacity = 0.12 + (cell.count / max) * 0.55;
            return (
              <tr
                key={`${cell.nicheId}-${cell.uf}`}
                className="cursor-pointer border-t border-white/[0.06]"
                onClick={() => onCell(cell.nicheId, cell.uf)}
              >
                <td className="px-2 py-1.5">{cell.nicheNome}</td>
                <td className="px-2 py-1.5 font-semibold">{cell.uf}</td>
                <td className="px-2 py-1.5">
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-xs font-bold"
                    style={{
                      backgroundColor: `rgba(245,179,1,${opacity})`,
                      outline: on ? "1px solid #f5b301" : undefined,
                    }}
                  >
                    {formatInt(cell.count)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OpsDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [offset, setOffset] = useState(0);

  const filters = useMemo(
    () => parseOpsDashboardFilters(searchParams),
    [searchParams],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [debounced, searchParams]);

  function setFilters(next: OpsDashboardFilters) {
    const qs = opsFiltersQueryString(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggle(key: OpsFilterDimension, value: string | boolean) {
    setFilters(toggleOpsDimension(filters, key, value));
  }

  const qs = opsFiltersQueryString(filters);

  const metricsQuery = useQuery({
    queryKey: ["ops-metrics", qs],
    queryFn: async () => {
      const res = await fetch(qs ? `/api/ops/metrics?${qs}` : "/api/ops/metrics");
      return readJson<OpsMetrics>(res);
    },
  });

  const usersQuery = useQuery({
    queryKey: ["ops-users", qs, debounced, offset],
    queryFn: async () => {
      const params = new URLSearchParams(qs);
      if (debounced) params.set("q", debounced);
      if (offset) params.set("offset", String(offset));
      const url = params.toString()
        ? `/api/ops/users?${params}`
        : "/api/ops/users";
      const res = await fetch(url);
      return readJson<OpsUserListPage>(res);
    },
  });

  useEffect(() => {
    const err = metricsQuery.error ?? usersQuery.error;
    if (err && err instanceof Error && "code" in err && err.code === "auth") {
      router.replace("/ops/entrar");
    }
  }, [metricsQuery.error, usersQuery.error, router]);

  const m = metricsQuery.data;
  const users = usersQuery.data?.users ?? [];
  const totalUsers = usersQuery.data?.total ?? 0;
  const error =
    metricsQuery.error instanceof Error
      ? metricsQuery.error.message
      : usersQuery.error instanceof Error
        ? usersQuery.error.message
        : null;

  const nicheLabel =
    m?.niches.find((row) => row.id === filters.nicheId)?.nome ??
    m?.segments.find((row) => row.id === filters.nicheId)?.nome;

  const cohortDonut = m
    ? (
        [
          ["active", m.active],
          ["trial", m.trial],
          ["free", m.free],
        ] as const
      ).map(([id, value]) => ({
        id,
        name: cohortLabel(id),
        value,
        fill: OPS_COHORT_COLORS[id],
      }))
    : [];

  const planBars = m
    ? Object.entries(m.byPlan)
        .sort((a, b) => b[1] - a[1])
        .map(([sku, value]) => ({
          id: sku,
          name: planLabel(sku),
          value,
        }))
    : [];

  const debitDonut = (m?.credits.debitByReason ?? []).map((row) => ({
    id: row.reason,
    name: debitReasonLabel(row.reason),
    value: row.amount,
    fill:
      row.reason === "enrich"
        ? OPS_CHART.enrich
        : row.reason === "export"
          ? OPS_CHART.export
          : OPS_CHART.other,
  }));

  const jobDonut = (m?.jobStatus ?? []).map((row, index) => ({
    id: row.status,
    name: jobStatusLabel(row.status),
    value: row.count,
    fill: [OPS_CHART.active, OPS_CHART.pack, OPS_CHART.export, OPS_CHART.trial, OPS_CHART.free][
      index % 5
    ]!,
  }));

  const kindDonut = (m?.revenue.byKind ?? []).map((row) => ({
    id: row.kind,
    name: orderKindLabel(row.kind),
    value: row.cents,
    fill:
      row.kind === "credit_pack"
        ? OPS_CHART.pack
        : row.kind === "platform"
          ? OPS_CHART.platform
          : OPS_CHART.subscription,
  }));

  const revenueHint = m
    ? `${formatBrl(m.revenue.monthCents)} neste mês · ${formatBrl(m.revenue.last30dCents)} em 30d · recargas ${formatBrl(m.recharge.cents)}`
    : undefined;

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Uso e faturamento</SectionTitle>
        <Hint className="mt-1">
          Hoje = quem buscou, qualificou, ligou ou pagou neste dia. Nos outros
          períodos, foto de pessoas = agora e eventos = recorte. Funil = quem
          cadastrou no período. Testes internos ficam de fora. Clique cruza o
          recorte.
        </Hint>
      </div>

      <OpsFilterBar
        filters={filters}
        onChange={setFilters}
        labels={{ niche: nicheLabel }}
      />

      {error && error !== "auth" ? (
        <p className="text-sm text-podium-alert">{error}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Usuários" value={m ? formatInt(m.users) : "—"} />
        <Kpi
          label="Ativos"
          value={m ? formatInt(m.active) : "—"}
          hint={
            m
              ? `${formatInt(m.canceling)} cancelam · ${formatInt(m.pastDue)} inadimplentes`
              : undefined
          }
        />
        <Kpi label="Trial" value={m ? formatInt(m.trial) : "—"} />
        <Kpi label="Treino livre" value={m ? formatInt(m.free) : "—"} />
        <Kpi
          label="Ativados"
          value={m ? formatInt(m.activated) : "—"}
          hint={
            m
              ? `${formatPct(m.activated, m.users)} do recorte concluiu o setup`
              : undefined
          }
        />
        <Kpi
          label="Faturado"
          value={m ? formatBrl(m.revenue.periodCents) : "—"}
          hint={revenueHint}
        />
        <Kpi
          label="MRR"
          value={m ? formatBrl(m.mrrCents) : "—"}
          hint="Ativos × preço do catálogo"
        />
        <Kpi
          label="Créditos"
          value={m ? formatInt(m.credits.remaining) : "—"}
          hint={
            m
              ? `${formatInt(m.credits.spentPeriod)} queimados no período · pack ${formatInt(m.credits.packRemaining)} no tanque`
              : undefined
          }
        />
      </div>

      <div>
        <SectionTitle>Pessoas</SectionTitle>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <OpsChartCard
            title="Coorte"
            hint="Treino livre, trial e ativo agora."
            active={Boolean(filters.cohort)}
          >
            <OpsDonut
              data={cohortDonut}
              activeId={filters.cohort}
              onSlice={(id) => toggle("cohort", id as OpsCohort)}
            />
          </OpsChartCard>
          <OpsChartCard
            title="Por plano"
            active={Boolean(filters.plan)}
          >
            <OpsHBar
              data={planBars}
              activeId={filters.plan}
              onBar={(id) => toggle("plan", id)}
            />
          </OpsChartCard>
          <OpsChartCard
            title="Funil de quem cadastrou no período"
            hint={
              m
                ? `${formatInt(m.funnel.recharged)} destes recarregaram`
                : undefined
            }
          >
            <OpsFunnelBars steps={m?.funnel.steps ?? []} />
          </OpsChartCard>
          <OpsChartCard title="Cadastros no período" hint="Empilhado pela coorte atual.">
            <OpsStackedArea
              data={m?.signups ?? []}
              series={[
                { key: "active", name: "Ativo", color: OPS_CHART.active },
                { key: "trial", name: "Trial", color: OPS_CHART.trial },
                { key: "free", name: "Treino livre", color: OPS_CHART.free },
              ]}
            />
          </OpsChartCard>
        </div>
      </div>

      <div>
        <SectionTitle>Mercado</SectionTitle>
        <Hint className="mt-1">
          Uma busca com vários UFs ou segmentos conta em cada um — é onde estão
          procurando.
          {m && m.intentSearches > 0
            ? ` ${formatInt(m.intentSearches)} buscas só com intenção livre.`
            : null}
        </Hint>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <OpsChartCard
            title="Nichos mais buscados"
            active={Boolean(filters.nicheId)}
          >
            <OpsHBar
              data={(m?.niches ?? []).map((row) => ({
                id: row.id,
                name: row.nome,
                value: row.count,
              }))}
              activeId={filters.nicheId}
              onBar={(id) => toggle("nicheId", id)}
            />
          </OpsChartCard>
          <OpsChartCard title="Segmentos" hint="Dentro do catálogo, no mesmo recorte.">
            <OpsHBar
              data={(m?.segments ?? []).map((row) => ({
                id: row.id,
                name: row.nome,
                value: row.count,
              }))}
              color={OPS_CHART.trial}
              activeId={filters.nicheId}
              onBar={(id) => toggle("nicheId", id)}
            />
          </OpsChartCard>
          <OpsChartCard title="Estados" active={Boolean(filters.uf)}>
            <OpsHBar
              data={(m?.ufs ?? []).map((row) => ({
                id: row.uf,
                name: row.uf,
                value: row.count,
              }))}
              color={OPS_CHART.pack}
              activeId={filters.uf}
              onBar={(id) => toggle("uf", id)}
            />
          </OpsChartCard>
          <OpsChartCard
            title="Nicho × UF"
            hint="Clique numa linha para cruzar os dois."
            active={Boolean(filters.nicheId && filters.uf)}
          >
            <Heatmap
              cells={m?.nicheUf ?? []}
              activeNiche={filters.nicheId}
              activeUf={filters.uf}
              onCell={(nicheId, uf) => {
                if (filters.nicheId === nicheId && filters.uf === uf) {
                  const next = { ...filters };
                  delete next.nicheId;
                  delete next.uf;
                  setFilters(next);
                  return;
                }
                setFilters({ ...filters, nicheId, uf });
              }}
            />
          </OpsChartCard>
        </div>
      </div>

      <div>
        <SectionTitle>Qualificação e recarga</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Qualificações"
            value={m ? formatInt(m.usage.enrichPeriod) : "—"}
            hint={m ? `${formatInt(m.usage.enrichTotal)} no total` : undefined}
          />
          <Kpi
            label="Quem recarregou"
            value={m ? formatInt(m.recharge.users) : "—"}
            hint={
              m
                ? `${formatBrl(m.recharge.cents)} · ${formatInt(m.recharge.orders)} pedidos`
                : undefined
            }
          />
          <Kpi
            label="Ativos com recarga"
            value={
              m
                ? formatPct(m.recharge.activeRecharged, m.recharge.activeUsers)
                : "—"
            }
            hint={
              m
                ? `${formatInt(m.recharge.activeRecharged)} de ${formatInt(m.recharge.activeUsers)}`
                : undefined
            }
          />
          <Kpi
            label="Pack no tanque"
            value={m ? formatInt(m.credits.packRemaining) : "—"}
            hint={
              m
                ? `${formatInt(m.credits.packSpentPeriod)} queimados no período`
                : undefined
            }
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <OpsChartCard title="Qualificações no período">
            <OpsLines
              data={(m?.enrichSeries ?? []).map((row) => ({
                day: row.day,
                count: row.count,
              }))}
              series={[{ key: "count", name: "Qualificações", color: OPS_CHART.enrich }]}
            />
          </OpsChartCard>
          <OpsChartCard title="Queima de crédito" hint="Qualificar é 1 crédito.">
            <OpsDonut data={debitDonut} />
          </OpsChartCard>
          <OpsChartCard
            title="Mix de recarga"
            active={filters.recharged !== undefined}
          >
            <OpsHBar
              data={(m?.packs ?? []).map((row) => ({
                id: row.sku,
                name: planLabel(row.sku),
                value: row.users,
              }))}
              color={OPS_CHART.pack}
              onBar={() => toggle("recharged", true)}
            />
          </OpsChartCard>
          <OpsChartCard title="Qualificações × recarga">
            <OpsHBar
              data={[
                {
                  id: "yes",
                  name: "Recarregou",
                  value: m?.recharge.enrichRecharged ?? 0,
                },
                {
                  id: "no",
                  name: "Sem recarga",
                  value: m?.recharge.enrichNotRecharged ?? 0,
                },
              ]}
              color={OPS_CHART.export}
              activeId={
                filters.recharged === true
                  ? "yes"
                  : filters.recharged === false
                    ? "no"
                    : undefined
              }
              onBar={(id) => toggle("recharged", id === "yes")}
            />
          </OpsChartCard>
          <OpsChartCard title="Tanque por origem">
            <OpsHBar
              data={(m?.credits.bySource ?? []).map((row) => ({
                id: row.source,
                name: lotSourceLabel(row.source),
                value: row.remaining,
              }))}
              color={OPS_CHART.platform}
            />
          </OpsChartCard>
        </div>
      </div>

      <div>
        <SectionTitle>Faturamento</SectionTitle>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <OpsChartCard title="Receita no período" hint="Empilhada por tipo de pedido.">
            <OpsStackedArea
              asMoney
              data={m?.revenueSeries ?? []}
              series={[
                {
                  key: "subscription_cycle",
                  name: "Mensalidade",
                  color: OPS_CHART.subscription,
                },
                { key: "credit_pack", name: "Recarga", color: OPS_CHART.pack },
                { key: "platform", name: "Plataforma", color: OPS_CHART.platform },
              ]}
            />
          </OpsChartCard>
          <OpsChartCard title="Mix no período">
            <OpsDonut data={kindDonut} />
          </OpsChartCard>
        </div>
      </div>

      <div>
        <SectionTitle>Uso</SectionTitle>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <OpsChartCard
            title="Buscas, qualificações e ligações"
            hint={
              m
                ? `${formatInt(m.usage.searchesPeriod)} buscas · ${formatInt(m.usage.enrichPeriod)} qualificações · ${formatInt(m.usage.callsPeriod)} ligações`
                : undefined
            }
          >
            <OpsLines
              data={m?.usageSeries ?? []}
              series={[
                { key: "searches", name: "Buscas", color: OPS_CHART.searches },
                { key: "enrich", name: "Qualificações", color: OPS_CHART.enrich },
                { key: "calls", name: "Ligações", color: OPS_CHART.calls },
              ]}
            />
          </OpsChartCard>
          <OpsChartCard title="Status das qualificações">
            <OpsDonut data={jobDonut} />
          </OpsChartCard>
        </div>
      </div>

      <OpsUsersTable
        users={users}
        total={totalUsers}
        q={q}
        onQ={setQ}
        offset={offset}
        onOffset={setOffset}
        loading={usersQuery.isLoading}
      />
    </div>
  );
}
