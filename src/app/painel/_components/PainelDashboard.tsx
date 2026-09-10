"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flame, Phone } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
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
import { LIVE_STATS_QUERY_OPTIONS } from "@/lib/live-stats";
import {
  PAINEL_PIPELINE_ALL,
  PAINEL_RANGES,
  painelFiltersQueryString,
  painelRangeLabel,
  parsePainelFilters,
  type PainelFilters,
} from "@/lib/painel/filters";
import type { PainelMetrics, PainelRange, PainelTaskRow } from "@/lib/painel/types";
import { ProductTour } from "@/components/tour/ProductTour";
import { Select } from "@/components/ui/Select";
import { buttonClassName } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function CrmLocked({ trialExpired }: { trialExpired: boolean }) {
  const copy = paywallCopy({
    kind: trialExpired ? "trial" : "plan",
    feature: "crm",
  });
  return (
    <GlassCard className="p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
        {copy.eyebrow}
      </p>
      <p className="mt-2 text-sm font-semibold">{copy.title}</p>
      <p className="mt-2 text-sm text-podium-gray">{copy.body}</p>
      <Link
        href={withFrom(copy.primary.href, "/painel")}
        className={buttonClassName({
          variant: "primary",
          size: "md",
          className: "mt-3",
        })}
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
  fadeKey,
}: {
  title: string;
  empty: string;
  rows: PainelTaskRow[];
  allNiches: boolean;
  kind: "overdue" | "won";
  wide?: boolean;
  fadeKey?: string;
}) {
  const reduce = useReducedMotion();
  const body =
    rows.length === 0 ? (
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
              href={kind === "overdue" ? "/box" : `/crm?deal=${row.dealId}&pipeline=${row.pipelineId}`}
              className="shrink-0 text-[11px] font-medium text-podium-yellow hover:underline"
            >
              {kind === "overdue" ? COPY.painelOpenBox : COPY.painelOpenCrm}
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <GlassCard className="flex h-full min-h-[240px] flex-col p-3" hover={false}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-podium-muted">{title}</p>
      {fadeKey == null ? (
        body
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={fadeKey}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            {body}
          </motion.div>
        </AnimatePresence>
      )}
    </GlassCard>
  );
}

export function PainelDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlFilters = useMemo(
    () => parsePainelFilters(searchParams),
    [searchParams],
  );
  const [pendingRange, setPendingRange] = useState<PainelRange | null>(null);
  const filters: PainelFilters =
    pendingRange != null ? { ...urlFilters, range: pendingRange } : urlFilters;

  useEffect(() => {
    if (pendingRange != null && pendingRange === urlFilters.range) {
      setPendingRange(null);
    }
  }, [pendingRange, urlFilters.range]);

  const setFilters = useMemo(() => {
    return (next: PainelFilters) => {
      const qs = painelFiltersQueryString(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };
  }, [pathname, router]);

  const reduce = useReducedMotion();

  function selectRange(range: PainelRange) {
    if (range === filters.range) return;
    setPendingRange(range);
    setFilters({ ...filters, range });
  }

  const query = useQuery({
    queryKey: ["painel-metrics", painelFiltersQueryString(filters)],
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
    placeholderData: keepPreviousData,
    ...LIVE_STATS_QUERY_OPTIONS,
  });

  const m = query.data;

  useEffect(() => {
    if (!m || !filters.pipelineId || m.pipelines.length === 0) return;
    if (m.pipelines.some((row) => row.id === filters.pipelineId)) return;
    const next = { ...filters };
    delete next.pipelineId;
    setFilters(next);
  }, [filters, m, setFilters]);

  const error = query.error instanceof Error ? query.error.message : null;
  const crm = Boolean(m?.crmAllowed);
  const k = m?.kpis;
  const missingCalls = k ? Math.max(0, k.callGoal - k.callsToday) : 0;
  const winWhole = (k?.wonPeriod ?? 0) + (k?.lostPeriod ?? 0);
  const rangeBadge = painelRangeLabel(filters.range);
  const allNiches = !filters.pipelineId;
  const crmHref = filters.pipelineId ? `/crm?pipeline=${filters.pipelineId}` : "/crm";
  const periodRefreshing = query.isFetching && query.isPlaceholderData;
  const winPct =
    crm && k && winWhole > 0 ? Math.round((k.wonPeriod / winWhole) * 100) : null;

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
      const next = { ...filters };
      delete next.pipelineId;
      setFilters(next);
      return;
    }
    setFilters({ ...filters, pipelineId: value });
  }

  return (
    <div className="space-y-5" data-tour="painel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="hidden text-[1.09375rem] font-semibold tracking-tight text-podium-white md:block">
            {COPY.painelHint}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div
            className="inline-flex flex-wrap rounded-lg border border-white/10 bg-white/[0.03] p-1"
            role="group"
            aria-label="Período"
          >
            {PAINEL_RANGES.map((range) => {
              const selected = filters.range === range;
              return (
                <button
                  key={range}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectRange(range)}
                  className={cn(
                    "relative rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150 ease-out",
                    selected
                      ? "text-podium-navy"
                      : "text-podium-muted hover:bg-white/10 hover:text-podium-white active:bg-white/[0.16] active:text-podium-white",
                  )}
                >
                  {selected ? (
                    <motion.span
                      layoutId={reduce ? undefined : "painel-range-pill"}
                      className="absolute inset-0 rounded-md bg-podium-yellow shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 520, damping: 38 }
                      }
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative z-10">{painelRangeLabel(range)}</span>
                </button>
              );
            })}
          </div>
          {(m?.pipelines.length ?? 0) > 1 ? (
            <label className="block min-w-0 sm:w-[220px] sm:min-w-[220px]">
              <span className="sr-only">Nicho</span>
              <Select
                value={filters.pipelineId ?? PAINEL_PIPELINE_ALL}
                onChange={selectPipeline}
                aria-label="Nicho"
                className="w-full"
                options={[
                  { value: PAINEL_PIPELINE_ALL, label: COPY.painelAllNiches },
                  ...(m?.pipelines.map((pipeline) => ({
                    value: pipeline.id,
                    label:
                      pipeline.openDeals > 0
                        ? `${pipeline.nome} · ${pipeline.openDeals}`
                        : pipeline.nome,
                  })) ?? []),
                ]}
              />
            </label>
          ) : null}
        </div>
      </div>

      {error && error !== "auth" ? (
        <p className="text-sm text-podium-alert">{error}</p>
      ) : null}

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <GlassCard className="p-3" hover={false} highlight={missingCalls > 0} data-tour="painel-meta">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative mx-auto shrink-0 sm:mx-0">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 scale-[1.55] bg-[radial-gradient(circle,rgba(245,179,1,0.16),transparent_62%)]"
              />
              <VoltaRing
                hoje={k?.callsToday ?? 0}
                meta={k?.callGoal ?? 20}
                size="md"
                className="relative"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                Trabalho do dia
              </p>
              <p className="mt-1 text-lg font-semibold leading-tight">
                {!k
                  ? "Carregando a meta…"
                  : missingCalls > 0
                    ? COPY.painelCallsLeft.replace("{n}", String(missingCalls))
                    : COPY.painelCallsDone}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[11px] font-medium text-podium-gray">
                  <Flame className="h-3 w-3 text-podium-yellow" />
                  {k ? (k.streak === 1 ? "1 dia" : `${k.streak} dias`) : "—"} de sequência
                </span>
                {crm && k && k.overdueFollowups > 0 ? (
                  <Link
                    href="/box"
                    className="inline-flex items-center rounded-md border border-podium-alert/40 bg-podium-alert/10 px-2 py-0.5 text-[11px] font-medium text-podium-alert"
                  >
                    {k.overdueFollowups === 1 ? "1 atrasado" : `${k.overdueFollowups} atrasados`}
                  </Link>
                ) : null}
              </div>
              <Link
                href="/box"
                data-tour="ligar-agora"
                className={buttonClassName({
                  variant: "primary",
                  size: "md",
                  className: "mt-3 min-h-11 w-full sm:w-auto md:min-h-0",
                })}
              >
                <Phone className="h-4 w-4" />
                Ligar agora
              </Link>
            </div>
          </div>
        </GlassCard>

        <GlassCard
          className={cn(
            "flex h-full flex-col p-3 transition-opacity duration-200",
            periodRefreshing && "opacity-70",
          )}
          hover={false}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
              Resultado
            </p>
            <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-podium-muted">
              {rangeBadge}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Link href={crm ? crmHref : "/box"} className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-podium-muted">
                Faturado
              </p>
              <p className="mt-1 truncate text-xl font-semibold tracking-tight">
                {!m ? (
                  "—"
                ) : crm && k ? (
                  <AnimatedNumber value={k.billedPeriodCents} format="brl" />
                ) : (
                  "—"
                )}
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
              <p className="text-[11px] font-medium uppercase tracking-wide text-podium-muted">
                Pipeline
              </p>
              <p className="mt-1 truncate text-xl font-semibold tracking-tight">
                {!m ? (
                  "—"
                ) : crm && k ? (
                  <AnimatedNumber value={k.pipelineOpenCents} format="brl" />
                ) : (
                  "—"
                )}
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
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-podium-muted">
              Win rate{" "}
              {winPct != null ? <AnimatedNumber value={winPct} format="pct" /> : "—"}
            </p>
            <div className="min-h-16">
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
                fadeKey={wonTasks.map((row) => row.id).join("|")}
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
          <GlassCard className="flex h-full flex-col justify-between p-3" hover={false}>
            <div>
              <p className="text-sm font-semibold">Listas</p>
              <Hint className="mt-1 hidden md:block">Geradas no recorte · mix atual das salvas.</Hint>
            </div>
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-podium-muted">Geradas</dt>
                <dd
                  className={cn(
                    "text-lg font-semibold tabular-nums transition-opacity duration-200",
                    periodRefreshing && "opacity-70",
                  )}
                >
                  {m ? <AnimatedNumber value={m.lists.generated} format="int" /> : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-podium-muted">Salvas</dt>
                <dd
                  className={cn(
                    "text-lg font-semibold tabular-nums transition-opacity duration-200",
                    periodRefreshing && "opacity-70",
                  )}
                >
                  {m ? <AnimatedNumber value={m.lists.saved} format="int" /> : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-xs text-podium-muted">Em ação / na fila</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {m ? (
                    <>
                      <AnimatedNumber value={leadsWorking} format="int" />
                      {" / "}
                      <AnimatedNumber value={leadsQueue} format="int" />
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
            <Link
              href="/largada"
              className={buttonClassName({
                variant: "primary",
                size: "md",
                className: "mt-3",
              })}
            >
              Nova lista
            </Link>
          </GlassCard>
        </div>
      </div>
      <ProductTour surface="painel" />
    </div>
  );
}
