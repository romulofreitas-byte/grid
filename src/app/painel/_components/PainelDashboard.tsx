"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame, Phone } from "lucide-react";
import { ChartCard } from "@/components/charts/ChartCard";
import {
  ChartDonut,
  ChartFunnel,
  ChartHBar,
  ChartHeatstrip,
  ChartSplitBar,
} from "@/components/charts/Charts";
import { CHART, formatInt } from "@/components/charts/chartTheme";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import { VoltaRing } from "@/components/VoltaRing";
import { formatBrl } from "@/lib/billing/catalog";
import { withFrom } from "@/lib/billing/href";
import { paywallCopy } from "@/lib/billing/paywall";
import { COPY } from "@/lib/copy";
import {
  PAINEL_PIPELINE_ALL,
  PAINEL_PIPELINE_STORAGE_KEY,
  PAINEL_RANGES,
  painelFiltersQueryString,
  painelRangeLabel,
  parsePainelFilters,
  type PainelFilters,
} from "@/lib/painel/filters";
import type { PainelMetrics, PainelRange, PainelTaskRow } from "@/lib/painel/types";
import { cn } from "@/lib/utils";

const PIPELINE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatPct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function readStoredPipeline(): string | null {
  try {
    return localStorage.getItem(PAINEL_PIPELINE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredPipeline(value: string) {
  try {
    localStorage.setItem(PAINEL_PIPELINE_STORAGE_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function CrmLocked({ trialExpired }: { trialExpired: boolean }) {
  const copy = paywallCopy({
    kind: trialExpired ? "trial" : "plan",
    feature: "crm",
  });
  return (
    <GlassCard className="p-6">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
        {copy.eyebrow}
      </p>
      <p className="mt-2 text-base font-semibold">{copy.title}</p>
      <p className="mt-2 text-sm text-podium-gray">{copy.body}</p>
      <Link
        href={withFrom(copy.primary.href, "/painel")}
        className="mt-4 inline-flex rounded-md bg-podium-yellow px-4 py-2 text-xs font-medium text-podium-navy"
      >
        {copy.primary.label}
      </Link>
    </GlassCard>
  );
}

function TaskList({
  title,
  empty,
  rows,
  allNiches,
  kind,
  wide = false,
}: {
  title: string;
  empty: string;
  rows: PainelTaskRow[];
  allNiches: boolean;
  kind: "overdue" | "won";
  wide?: boolean;
}) {
  return (
    <GlassCard className="flex h-full min-h-[240px] flex-col p-4" hover={false}>
      <p className="text-sm font-bold">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-podium-muted">{empty}</p>
      ) : (
        <ul
          className={cn(
            "mt-3 flex-1",
            wide
              ? "grid sm:grid-cols-2 sm:gap-x-6"
              : "divide-y divide-white/5",
          )}
        >
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.companyName}</p>
                <p
                  className={cn(
                    "truncate text-[11px]",
                    kind === "overdue" ? "text-podium-alert" : "text-podium-muted",
                  )}
                >
                  {kind === "won"
                    ? row.amountCents != null
                      ? formatBrl(row.amountCents)
                      : "Sem valor"
                    : row.subtitle}
                  {allNiches && row.pipelineNome ? ` · ${row.pipelineNome}` : ""}
                </p>
              </div>
              <Link
                href={`/crm?deal=${row.dealId}&pipeline=${row.pipelineId}`}
                className="shrink-0 text-[11px] font-medium text-podium-yellow hover:underline"
              >
                {COPY.painelOpenCrm}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

export function PainelDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parsePainelFilters(searchParams),
    [searchParams],
  );
  const [filtersReady, setFiltersReady] = useState(() => Boolean(filters.pipelineId));
  const suggestedApplied = useRef(false);

  const setFilters = useMemo(() => {
    return (next: PainelFilters) => {
      const qs = painelFiltersQueryString(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };
  }, [pathname, router]);

  useLayoutEffect(() => {
    if (filters.pipelineId) {
      writeStoredPipeline(filters.pipelineId);
      setFiltersReady(true);
      return;
    }
    const stored = readStoredPipeline();
    if (stored && stored !== PAINEL_PIPELINE_ALL && PIPELINE_UUID.test(stored)) {
      setFilters({ ...filters, pipelineId: stored });
    }
    setFiltersReady(true);
    // Mount-only: hydrate last nicho before the first fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useQuery({
    queryKey: ["painel-metrics", painelFiltersQueryString(filters)],
    enabled: filtersReady,
    queryFn: async () => {
      const qs = painelFiltersQueryString(filters);
      const res = await fetch(`/api/painel/metrics${qs ? `?${qs}` : ""}`);
      const data = (await res.json()) as PainelMetrics & { error?: string };
      if (res.status === 401) {
        throw Object.assign(new Error("auth"), { code: "auth" });
      }
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar");
      return data as PainelMetrics;
    },
  });

  const m = query.data;

  useEffect(() => {
    if (!m) return;
    if (
      filters.pipelineId &&
      m.pipelines.length > 0 &&
      !m.pipelines.some((row) => row.id === filters.pipelineId)
    ) {
      writeStoredPipeline(PAINEL_PIPELINE_ALL);
      const next = { ...filters };
      delete next.pipelineId;
      setFilters(next);
      return;
    }
    if (!filtersReady || filters.pipelineId || !m.suggestedPipelineId) return;
    if (suggestedApplied.current) return;
    const stored = readStoredPipeline();
    if (stored === PAINEL_PIPELINE_ALL) return;
    if (stored && PIPELINE_UUID.test(stored)) return;
    suggestedApplied.current = true;
    setFilters({ ...filters, pipelineId: m.suggestedPipelineId });
  }, [filtersReady, filters, m, setFilters]);

  const error = query.error instanceof Error ? query.error.message : null;
  const crm = Boolean(m?.crmAllowed);
  const k = m?.kpis;
  const missingCalls = k ? Math.max(0, k.callGoal - k.callsToday) : 0;
  const winWhole = (k?.wonPeriod ?? 0) + (k?.lostPeriod ?? 0);
  const rangeBadge = painelRangeLabel(filters.range);
  const allNiches = !filters.pipelineId;
  const crmHref = filters.pipelineId ? `/crm?pipeline=${filters.pipelineId}` : "/crm";

  const followupDonut = (m?.followups ?? [])
    .filter((row) => row.id !== "none")
    .map((row) => ({
      id: row.id,
      name: row.name,
      value: row.value,
      fill:
        row.id === "overdue"
          ? CHART.overdue
          : row.id === "today"
            ? CHART.today
            : CHART.scheduled,
    }));
  const noneFollowups = m?.followups.find((row) => row.id === "none")?.value ?? 0;

  const overdueTasks = (m?.tasks ?? []).filter((row) => row.kind === "overdue");
  const wonTasks = (m?.tasks ?? []).filter((row) => row.kind === "won");
  const leadsWorking =
    m?.lists.leadStatus
      .filter((row) => row.id === "ligando" || row.id === "reuniao")
      .reduce((sum, row) => sum + row.value, 0) ?? 0;
  const leadsQueue = m?.lists.leadStatus.find((row) => row.id === "novo")?.value ?? 0;

  function selectPipeline(value: string) {
    if (value === PAINEL_PIPELINE_ALL) {
      suggestedApplied.current = true;
      writeStoredPipeline(PAINEL_PIPELINE_ALL);
      const next = { ...filters };
      delete next.pipelineId;
      setFilters(next);
      return;
    }
    writeStoredPipeline(value);
    setFilters({ ...filters, pipelineId: value });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionTitle>{COPY.painelTitle}</SectionTitle>
          <Hint className="mt-1 max-w-xl">{COPY.painelHint}</Hint>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {PAINEL_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setFilters({ ...filters, range: range as PainelRange })}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-bold transition",
                  filters.range === range
                    ? "bg-podium-yellow text-podium-navy"
                    : "text-podium-muted hover:text-podium-white",
                )}
              >
                {painelRangeLabel(range)}
              </button>
            ))}
          </div>
          {(m?.pipelines.length ?? 0) > 1 ? (
            <label className="block min-w-[220px]">
              <span className="sr-only">Nicho</span>
              <select
                value={filters.pipelineId ?? PAINEL_PIPELINE_ALL}
                onChange={(event) => selectPipeline(event.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-podium-panel px-3 text-sm text-podium-white outline-none focus:border-podium-yellow/40"
              >
                <option value={PAINEL_PIPELINE_ALL}>{COPY.painelAllNiches}</option>
                {m?.pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.nome}
                    {pipeline.openDeals > 0 ? ` · ${pipeline.openDeals}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {error && error !== "auth" ? (
        <p className="text-sm text-podium-alert">{error}</p>
      ) : null}

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <GlassCard className="p-5" hover={false} highlight={missingCalls > 0}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative mx-auto shrink-0 sm:mx-0">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 scale-[1.55] bg-[radial-gradient(circle,rgba(245,179,1,0.16),transparent_62%)]"
              />
              <VoltaRing
                hoje={k?.callsToday ?? 0}
                meta={k?.callGoal ?? 20}
                size="lg"
                className="relative"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
                Trabalho do dia
              </p>
              <p className="mt-1 text-xl font-extrabold leading-tight">
                {!k
                  ? "Carregando a meta…"
                  : missingCalls > 0
                    ? COPY.painelCallsLeft.replace("{n}", String(missingCalls))
                    : COPY.painelCallsDone}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-podium-gray">
                  <Flame className="h-3 w-3 text-podium-yellow" />
                  {k ? (k.streak === 1 ? "1 dia" : `${k.streak} dias`) : "—"} de sequência
                </span>
                {crm && k && k.overdueFollowups > 0 ? (
                  <Link
                    href={crmHref}
                    className="inline-flex items-center rounded-full border border-podium-alert/40 bg-podium-alert/10 px-2.5 py-1 text-[11px] font-semibold text-podium-alert"
                  >
                    {k.overdueFollowups === 1 ? "1 atrasado" : `${k.overdueFollowups} atrasados`}
                  </Link>
                ) : null}
              </div>
              <Link
                href="/box"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-podium-yellow px-5 py-2.5 text-sm font-extrabold text-podium-navy hover:brightness-110"
              >
                <Phone className="h-4 w-4" />
                Ligar agora
              </Link>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="flex h-full flex-col p-5" hover={false}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
              Resultado
            </p>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-podium-muted">
              {rangeBadge}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Link href={crm ? crmHref : "/box"} className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-podium-muted">
                Faturado
              </p>
              <p className="mt-1 truncate text-2xl font-extrabold tracking-tight md:text-3xl">
                {!m ? "—" : crm && k ? formatBrl(k.billedPeriodCents) : "—"}
              </p>
              <Hint className="mt-1">
                {!m
                  ? "Carregando o recorte…"
                  : crm && k && k.wonWithoutAmount > 0
                    ? k.wonWithoutAmount === 1
                      ? COPY.painelWonWithoutAmountOne
                      : COPY.painelWonWithoutAmount.replace("{n}", String(k.wonWithoutAmount))
                    : crm
                      ? COPY.painelFillAmount
                      : "Libere o CRM para ver o faturado."}
              </Hint>
            </Link>
            <Link href={crm ? crmHref : "/box"} className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-podium-muted">
                Pipeline
              </p>
              <p className="mt-1 truncate text-2xl font-extrabold tracking-tight md:text-3xl">
                {!m ? "—" : crm && k ? formatBrl(k.pipelineOpenCents) : "—"}
              </p>
              <Hint className="mt-1">
                {!m
                  ? "Carregando o pipeline…"
                  : crm && k
                    ? `${formatInt(k.openDeals)} abertos · ${formatInt(k.openWithAmount)} com valor`
                    : "Negócios em andamento"}
              </Hint>
            </Link>
          </div>
          <div className="mt-5 flex-1">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-podium-muted">
              Win rate {crm && k ? formatPct(k.wonPeriod, winWhole) : "—"}
            </p>
            {m && crm ? (
              <ChartSplitBar
                left={{
                  name: "Ganho",
                  value: k?.wonPeriod ?? 0,
                  color: CHART.won,
                }}
                right={{
                  name: "Perdido",
                  value: k?.lostPeriod ?? 0,
                  color: CHART.lost,
                }}
              />
            ) : (
              <Hint>
                {!m
                  ? "Carregando o recorte…"
                  : "Libere o CRM para ver ganhos e perdidos."}
              </Hint>
            )}
          </div>
        </GlassCard>
      </div>

      {!m ? null : !crm ? (
        <CrmLocked trialExpired={Boolean(m.trialExpired)} />
      ) : (
        <>
          <div>
            <SectionTitle>Funil</SectionTitle>
            <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-2">
              <ChartCard
                title="Alcance"
                badge="Agora"
                hint="Quem já chegou em cada marco. Foto atual, fora do recorte de datas."
              >
                <ChartFunnel steps={m.funnel} />
              </ChartCard>
              <ChartCard
                title="Onde estão"
                badge="Agora"
                hint="Abertos agora, somados por etapa — um nome, todos os nichos."
              >
                <ChartHBar
                  data={m.pipeline}
                  onBar={() => router.push(crmHref)}
                />
              </ChartCard>
            </div>
          </div>

          <div>
            <SectionTitle>O que fazer agora</SectionTitle>
            <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-2">
              <ChartCard
                title="Próximas ações"
                badge="Agora"
                hint="Só fichas com prazo. Sem data ficam no aviso abaixo."
              >
                <ChartDonut data={followupDonut} />
                {noneFollowups > 0 ? (
                  <p className="mt-3 text-xs text-podium-gray">
                    {formatInt(noneFollowups)} fichas sem próxima data.{" "}
                    <Link href={crmHref} className="font-semibold text-podium-yellow hover:underline">
                      Agendar no CRM
                    </Link>
                  </p>
                ) : null}
              </ChartCard>
              <TaskList
                title={COPY.painelTasksOverdue}
                empty={COPY.painelNoOverdue}
                rows={overdueTasks}
                allNiches={allNiches}
                kind="overdue"
              />
              <div className="lg:col-span-2">
                <TaskList
                  title={COPY.painelTasksWon}
                  empty={COPY.painelNoWins}
                  rows={wonTasks}
                  allNiches={allNiches}
                  kind="won"
                  wide
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        <SectionTitle>Ritmo</SectionTitle>
        <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-3">
          <ChartCard
            title="Ligações"
            badge="14 dias"
            hint="Amarelo cheio = meta batida naquele dia."
            className="lg:col-span-2"
          >
            <ChartHeatstrip
              data={(m?.habit ?? []).map((row) => ({
                day: row.day,
                calls: row.calls,
              }))}
              goal={k?.callGoal ?? 20}
            />
          </ChartCard>
          <GlassCard className="flex h-full flex-col justify-between p-4" hover={false}>
            <div>
              <p className="text-sm font-bold">Listas</p>
              <Hint className="mt-1">Geradas no recorte · mix atual das salvas.</Hint>
            </div>
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-podium-muted">Geradas</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  {m ? formatInt(m.lists.generated) : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-podium-muted">Salvas</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  {m ? formatInt(m.lists.saved) : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-podium-muted">Em ação / na fila</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  {m ? `${formatInt(leadsWorking)} / ${formatInt(leadsQueue)}` : "—"}
                </dd>
              </div>
            </dl>
            <Link
              href="/largada"
              className="mt-4 inline-flex rounded-md bg-podium-yellow px-3 py-2 text-center text-[11px] font-bold text-podium-navy hover:brightness-110"
            >
              Nova lista
            </Link>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
