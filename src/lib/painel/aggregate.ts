import { CRM_ACTIVITY_KIND_LABELS, activitySignal } from "@/lib/crm/activity";
import {
  DEFAULT_CADENCE_ENTRIES,
  isCrmStageKey,
  type CrmStageKey,
} from "@/lib/crm/cadence";
import type { CrmActivityKind } from "@/lib/crm/types";
import { callStreak, callsOnDay, saoPauloDay } from "@/lib/call-stats";
import { inPeriod, lastNDays, periodStartMs } from "@/lib/painel/period";
import type {
  PainelActivityRow,
  PainelDealRow,
  PainelFunnelStep,
  PainelKpis,
  PainelMetrics,
  PainelNamedCount,
  PainelOutcomeEvent,
  PainelSnapshot,
  PainelTaskRow,
} from "@/lib/painel/types";

const STAGE_RANK: Record<CrmStageKey, number> = {
  entrada: 0,
  tentando_contato: 1,
  contato_respondido: 2,
  followup_decisor: 3,
  reuniao_agendada: 4,
  reuniao_realizada: 5,
  ajustando_proposta: 6,
  proposta_apresentada: 7,
  negociacao: 8,
  contrato_fechado: 9,
  descartado: -1,
};

const FUNNEL: { id: string; label: string; minRank: number | "won" }[] = [
  { id: "entrada", label: "Entrada", minRank: 0 },
  { id: "tentou", label: "Tentou contato", minRank: 1 },
  { id: "reuniao", label: "Reunião", minRank: 4 },
  { id: "proposta", label: "Proposta", minRank: 6 },
  { id: "ganhou", label: "Ganhou", minRank: "won" },
];

const LEAD_STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  ligando: "Ligando",
  reuniao: "Reunião",
  descartado: "Descartado",
};

function activityKindLabel(kind: string): string {
  if (kind in CRM_ACTIVITY_KIND_LABELS) {
    return CRM_ACTIVITY_KIND_LABELS[kind as CrmActivityKind];
  }
  return kind;
}

function funnelRank(deal: PainelDealRow): number {
  if (deal.outcome === "won") return 9;
  const key = isCrmStageKey(deal.canonical_key) ? deal.canonical_key : null;
  if (!key || key === "descartado") return 0;
  return STAGE_RANK[key] ?? 0;
}

function pipelineBucket(deal: PainelDealRow): {
  id: string;
  name: string;
  rank: number;
} | null {
  if (deal.canonical_key === "descartado") return null;
  if (deal.canonical_key && isCrmStageKey(deal.canonical_key)) {
    const entry = DEFAULT_CADENCE_ENTRIES.find((row) => row.key === deal.canonical_key);
    return {
      id: deal.canonical_key,
      name: entry?.nome ?? deal.stage_nome,
      rank: STAGE_RANK[deal.canonical_key] ?? 50,
    };
  }
  const name = deal.stage_nome.trim() || "Etapa";
  return { id: `name:${name.toLowerCase()}`, name, rank: 50 };
}

function overdueParts(
  kind: string,
  dueAt: string,
  now: Date,
): { subtitle: string; overdueDays: number } {
  const due = new Date(dueAt).getTime();
  const days = Number.isNaN(due)
    ? 0
    : Math.max(0, Math.floor((now.getTime() - due) / 86_400_000));
  const label = activityKindLabel(kind);
  if (days <= 0) return { subtitle: `${label} · atrasada hoje`, overdueDays: 0 };
  if (days === 1) return { subtitle: `${label} · 1 dia atrasada`, overdueDays: 1 };
  return { subtitle: `${label} · ${days} dias atrasada`, overdueDays: days };
}

function latestOutcomeAt(
  dealId: string,
  events: PainelOutcomeEvent[],
  fallback: string,
): string {
  const matches = events
    .filter((row) => row.deal_id === dealId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return matches[0]?.created_at ?? fallback;
}

function emptyKpis(callGoal: number, callsToday: number, streak: number): PainelKpis {
  return {
    callsToday,
    callGoal,
    streak,
    overdueFollowups: 0,
    billedPeriodCents: 0,
    pipelineOpenCents: 0,
    wonPeriod: 0,
    lostPeriod: 0,
    wonWithoutAmount: 0,
    openDeals: 0,
    openWithAmount: 0,
    openWithoutNext: 0,
  };
}

function emptyCrmCharts(): Pick<
  PainelMetrics,
  "funnel" | "pipeline" | "followups" | "outcomes" | "tasks"
> {
  return {
    funnel: FUNNEL.map((step) => ({ id: step.id, label: step.label, count: 0 })),
    pipeline: [],
    followups: [
      { id: "overdue", name: "Atrasado", value: 0 },
      { id: "today", name: "Hoje", value: 0 },
      { id: "scheduled", name: "Agendado", value: 0 },
      { id: "none", name: "Sem prazo", value: 0 },
    ],
    outcomes: [
      { id: "won", name: "Ganho", value: 0 },
      { id: "lost", name: "Perdido", value: 0 },
    ],
    tasks: [],
  };
}

export function emptyPainelMetrics(partial: {
  range: PainelMetrics["range"];
  pipelineId: string | null;
  suggestedPipelineId?: string | null;
  crmAllowed: boolean;
  trialExpired: boolean;
  pipelines?: PainelMetrics["pipelines"];
  callGoal?: number;
  callsToday?: number;
  streak?: number;
  lists?: PainelMetrics["lists"];
  habit?: PainelMetrics["habit"];
}): PainelMetrics {
  return {
    range: partial.range,
    pipelineId: partial.pipelineId,
    crmAllowed: partial.crmAllowed,
    trialExpired: partial.trialExpired,
    suggestedPipelineId: partial.suggestedPipelineId ?? null,
    pipelines: partial.pipelines ?? [],
    kpis: emptyKpis(
      partial.callGoal ?? 20,
      partial.callsToday ?? 0,
      partial.streak ?? 0,
    ),
    ...emptyCrmCharts(),
    lists: partial.lists ?? {
      generated: 0,
      saved: 0,
      leadStatus: [],
    },
    habit: partial.habit ?? [],
  };
}

export function aggregatePainel(input: PainelSnapshot): Omit<
  PainelMetrics,
  "crmAllowed" | "trialExpired"
> {
  const startMs = periodStartMs(input.range, input.now);
  const today = saoPauloDay(input.now);
  const callsToday = callsOnDay(input.callCreatedAt, today);
  const streak = callStreak(input.callCreatedAt, input.now);
  const habit = lastNDays(input.now, 14).map((day) => ({
    day,
    calls: callsOnDay(input.callCreatedAt, day),
    meta: input.callGoal,
  }));

  const listsGenerated = input.searches.filter((row) =>
    inPeriod(row.created_at, startMs),
  );
  const leadStatusMap = new Map<string, number>();
  for (const lead of input.leads) {
    leadStatusMap.set(lead.status, (leadStatusMap.get(lead.status) ?? 0) + 1);
  }
  const leadStatus: PainelNamedCount[] = ["novo", "ligando", "reuniao", "descartado"].map(
    (id) => ({
      id,
      name: LEAD_STATUS_LABEL[id] ?? id,
      value: leadStatusMap.get(id) ?? 0,
    }),
  );

  const lists = {
    generated: listsGenerated.length,
    saved: listsGenerated.filter((row) => row.saved).length,
    leadStatus,
  };

  const activityByDeal = new Map<string, PainelActivityRow>();
  for (const row of input.activities) {
    if (row.status !== "open") continue;
    activityByDeal.set(row.deal_id, row);
  }

  let overdueFollowups = 0;
  let billedPeriodCents = 0;
  let pipelineOpenCents = 0;
  let wonPeriod = 0;
  let lostPeriod = 0;
  let wonWithoutAmount = 0;
  let openDeals = 0;
  let openWithAmount = 0;
  let openWithoutNext = 0;

  const pipelineNomeById = new Map(input.pipelines.map((row) => [row.id, row.nome]));
  const stageCounts = new Map<string, { name: string; value: number; rank: number }>();
  const followupCounts = { overdue: 0, today: 0, scheduled: 0, none: 0 };
  const funnelCounts = new Map<string, number>(FUNNEL.map((step) => [step.id, 0]));
  const tasks: PainelTaskRow[] = [];

  for (const deal of input.deals) {
    const rank = funnelRank(deal);
    for (const step of FUNNEL) {
      const ok = step.minRank === "won" ? deal.outcome === "won" : rank >= step.minRank;
      if (ok) funnelCounts.set(step.id, (funnelCounts.get(step.id) ?? 0) + 1);
    }

    if (deal.outcome === "open") {
      openDeals += 1;
      if (deal.amount_cents != null) {
        pipelineOpenCents += deal.amount_cents;
        openWithAmount += 1;
      }
      const bucket = pipelineBucket(deal);
      if (bucket) {
        const stage = stageCounts.get(bucket.id) ?? {
          name: bucket.name,
          value: 0,
          rank: bucket.rank,
        };
        stage.value += 1;
        stageCounts.set(bucket.id, stage);
      }

      const next = activityByDeal.get(deal.id) ?? null;
      const signal = activitySignal(
        next
          ? { due_at: next.due_at, status: next.status }
          : null,
        input.now,
      );
      followupCounts[signal] += 1;
      if (signal === "none") openWithoutNext += 1;
      if (signal === "overdue") {
        overdueFollowups += 1;
        const parts = next
          ? overdueParts(next.kind, next.due_at, input.now)
          : { subtitle: "Follow-up atrasado", overdueDays: 0 };
        tasks.push({
          id: `overdue-${deal.id}`,
          kind: "overdue",
          companyName: deal.company_name,
          subtitle: parts.subtitle,
          dealId: deal.id,
          pipelineId: deal.pipeline_id,
          pipelineNome: pipelineNomeById.get(deal.pipeline_id) ?? null,
          amountCents: deal.amount_cents,
          overdueDays: parts.overdueDays,
        });
      }
    }

    if (deal.outcome === "won" || deal.outcome === "lost") {
      const when = latestOutcomeAt(deal.id, input.outcomeEvents, deal.updated_at);
      if (!inPeriod(when, startMs)) continue;
      if (deal.outcome === "won") {
        wonPeriod += 1;
        if (deal.amount_cents == null) wonWithoutAmount += 1;
        else billedPeriodCents += deal.amount_cents;
        tasks.push({
          id: `won-${deal.id}`,
          kind: "won",
          companyName: deal.company_name,
          subtitle: "Ganho",
          dealId: deal.id,
          pipelineId: deal.pipeline_id,
          pipelineNome: pipelineNomeById.get(deal.pipeline_id) ?? null,
          amountCents: deal.amount_cents,
          overdueDays: null,
        });
      } else {
        lostPeriod += 1;
      }
    }
  }

  const funnel: PainelFunnelStep[] = FUNNEL.map((step) => ({
    id: step.id,
    label: step.label,
    count: funnelCounts.get(step.id) ?? 0,
  }));

  const pipeline: PainelNamedCount[] = [...stageCounts.entries()]
    .map(([id, row]) => ({ id, name: row.name, value: row.value, rank: row.rank }))
    .sort((a, b) => a.rank - b.rank || b.value - a.value)
    .map(({ id, name, value }) => ({ id, name, value }));

  const followups: PainelNamedCount[] = [
    { id: "overdue", name: "Atrasado", value: followupCounts.overdue },
    { id: "today", name: "Hoje", value: followupCounts.today },
    { id: "scheduled", name: "Agendado", value: followupCounts.scheduled },
    { id: "none", name: "Sem prazo", value: followupCounts.none },
  ];

  const outcomes: PainelNamedCount[] = [
    { id: "won", name: "Ganho", value: wonPeriod },
    { id: "lost", name: "Perdido", value: lostPeriod },
  ];

  const overdueTasks = tasks
    .filter((row) => row.kind === "overdue")
    .sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0))
    .slice(0, 8);
  const wonTasks = tasks.filter((row) => row.kind === "won").slice(0, 6);

  return {
    range: input.range,
    pipelineId: input.pipelineId,
    suggestedPipelineId: null,
    pipelines: input.pipelines,
    kpis: {
      callsToday,
      callGoal: input.callGoal,
      streak,
      overdueFollowups,
      billedPeriodCents,
      pipelineOpenCents,
      wonPeriod,
      lostPeriod,
      wonWithoutAmount,
      openDeals,
      openWithAmount,
      openWithoutNext,
    },
    funnel,
    pipeline,
    followups,
    outcomes,
    lists,
    habit,
    tasks: [...overdueTasks, ...wonTasks],
  };
}
