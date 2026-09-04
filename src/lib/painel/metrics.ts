import { getBalance } from "@/lib/billing/service";
import { pickDefaultCrmPipeline } from "@/lib/crm/bridge";
import { isCrmStageKey } from "@/lib/crm/cadence";
import { getDataSource, hasLiveDatabase } from "@/lib/data";
import { getMockStore } from "@/lib/data/mock-store";
import { isUndefinedColumnError, isUndefinedTableError, query } from "@/lib/data/pg";
import { DEFAULT_CALL_GOAL } from "@/lib/pilot-profile";
import type { CrmOutcome } from "@/lib/crm/types";
import { aggregatePainel, emptyPainelMetrics } from "@/lib/painel/aggregate";
import type { PainelFilters } from "@/lib/painel/filters";
import type {
  PainelActivityRow,
  PainelDealRow,
  PainelMetrics,
  PainelOutcomeEvent,
  PainelPipelineOption,
} from "@/lib/painel/types";

export class PainelDataError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "PainelDataError";
    this.status = status;
  }
}

function asIso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function mapOutcome(value: unknown): CrmOutcome {
  return value === "won" || value === "lost" ? value : "open";
}

function mapOutcomeEvent(value: unknown): PainelOutcomeEvent["outcome"] {
  if (value === "won" || value === "lost" || value === "open") return value;
  return null;
}

async function optionalQuery<T extends Record<string, unknown>>(
  text: string,
  params: unknown[],
): Promise<T[]> {
  try {
    const { rows } = await query<T>(text, params);
    return rows;
  } catch (err) {
    if (isUndefinedTableError(err) || isUndefinedColumnError(err)) return [];
    throw err;
  }
}

async function loadPainelMetricsPg(
  userId: string,
  filters: PainelFilters,
  now: Date,
): Promise<Omit<PainelMetrics, "crmAllowed" | "trialExpired">> {
  const pipelineId = filters.pipelineId ?? null;
  const [
    profileRows,
    callRows,
    searchRows,
    leadRows,
    pipelineRows,
    dealRows,
    activityRows,
    eventRows,
  ] = await Promise.all([
    query<{ meta_ligacoes_dia: number | null }>(
      `select meta_ligacoes_dia from profiles where id = $1`,
      [userId],
    ),
    optionalQuery<{ created_at: string }>(
      `select created_at from call_events where user_id = $1`,
      [userId],
    ),
    optionalQuery<{ created_at: string; saved: boolean }>(
      `select created_at, saved from searches where user_id = $1`,
      [userId],
    ),
    optionalQuery<{ status: string }>(
      `select status from saved_leads where user_id = $1`,
      [userId],
    ),
    optionalQuery<{ id: string; nome: string; open_deals: number }>(
      `select p.id, p.nome,
              count(d.id) filter (where d.outcome = 'open')::int as open_deals
         from crm_pipelines p
         left join crm_deals d on d.pipeline_id = p.id
        where p.user_id = $1
        group by p.id, p.nome, p.position, p.created_at
        order by p.position, p.created_at`,
      [userId],
    ),
    optionalQuery<{
      id: string;
      company_name: string;
      pipeline_id: string;
      stage_id: string;
      stage_nome: string;
      canonical_key: string | null;
      outcome: string;
      amount_cents: number | null;
      created_at: string;
      updated_at: string;
    }>(
      `select d.id, d.company_name, d.pipeline_id, d.stage_id,
              s.nome as stage_nome, s.canonical_key, d.outcome, d.amount_cents,
              d.created_at, d.updated_at
         from crm_deals d
         join crm_pipelines p on p.id = d.pipeline_id
         join crm_stages s on s.id = d.stage_id
        where p.user_id = $1
          and ($2::uuid is null or d.pipeline_id = $2)`,
      [userId, pipelineId],
    ),
    optionalQuery<{
      deal_id: string;
      kind: string;
      due_at: string;
      status: string;
    }>(
      `select a.deal_id, a.kind, a.due_at, a.status
         from crm_activities a
         join crm_deals d on d.id = a.deal_id
         join crm_pipelines p on p.id = d.pipeline_id
        where p.user_id = $1
          and a.status = 'open'
          and ($2::uuid is null or d.pipeline_id = $2)`,
      [userId, pipelineId],
    ),
    optionalQuery<{
      deal_id: string;
      created_at: string;
      meta: unknown;
    }>(
      `select e.deal_id, e.created_at, e.meta
         from crm_events e
         join crm_deals d on d.id = e.deal_id
         join crm_pipelines p on p.id = d.pipeline_id
        where p.user_id = $1
          and e.kind = 'outcome'
          and ($2::uuid is null or d.pipeline_id = $2)`,
      [userId, pipelineId],
    ),
  ]);

  const pipelines: PainelPipelineOption[] = pipelineRows.map((row) => ({
    id: String(row.id),
    nome: String(row.nome),
    openDeals: Number(row.open_deals ?? 0),
  }));
  const deals: PainelDealRow[] = dealRows.map((row) => ({
    id: String(row.id),
    company_name: String(row.company_name),
    pipeline_id: String(row.pipeline_id),
    stage_id: String(row.stage_id),
    stage_nome: String(row.stage_nome),
    canonical_key: isCrmStageKey(row.canonical_key) ? row.canonical_key : null,
    outcome: mapOutcome(row.outcome),
    amount_cents:
      row.amount_cents == null ? null : Number(row.amount_cents),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  }));
  const activities: PainelActivityRow[] = activityRows.map((row) => ({
    deal_id: String(row.deal_id),
    kind: String(row.kind),
    due_at: asIso(row.due_at),
    status: row.status === "done" ? "done" : "open",
  }));
  const outcomeEvents: PainelOutcomeEvent[] = eventRows.map((row) => {
    const meta =
      row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
        ? (row.meta as Record<string, unknown>)
        : {};
    return {
      deal_id: String(row.deal_id),
      created_at: asIso(row.created_at),
      outcome: mapOutcomeEvent(meta.outcome),
    };
  });

  const aggregated = aggregatePainel({
    now,
    range: filters.range,
    pipelineId,
    callGoal: Number(profileRows.rows[0]?.meta_ligacoes_dia ?? DEFAULT_CALL_GOAL) || DEFAULT_CALL_GOAL,
    callCreatedAt: callRows.map((row) => asIso(row.created_at)),
    searches: searchRows.map((row) => ({
      created_at: asIso(row.created_at),
      saved: Boolean(row.saved),
    })),
    leads: leadRows.map((row) => ({ status: String(row.status) })),
    pipelines,
    deals,
    activities,
    outcomeEvents,
  });

  return {
    ...aggregated,
    suggestedPipelineId:
      pickDefaultCrmPipeline(
        pipelines.map((row) => ({ ...row, deal_count: row.openDeals })),
      )?.id ?? null,
  };
}

function loadPainelMetricsMock(
  userId: string,
  filters: PainelFilters,
  now: Date,
): Omit<PainelMetrics, "crmAllowed" | "trialExpired"> {
  const store = getMockStore();
  const pipelineId = filters.pipelineId ?? null;
  const owned = new Set(
    store.crm_pipelines.filter((row) => row.user_id === userId).map((row) => row.id),
  );
  const pipelines: PainelPipelineOption[] = store.crm_pipelines
    .filter((row) => row.user_id === userId)
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      id: row.id,
      nome: row.nome,
      openDeals: store.crm_deals.filter(
        (deal) => deal.pipeline_id === row.id && deal.outcome === "open",
      ).length,
    }));
  const stages = new Map(store.crm_stages.map((row) => [row.id, row]));
  const deals: PainelDealRow[] = store.crm_deals
    .filter((row) => owned.has(row.pipeline_id))
    .filter((row) => pipelineId == null || row.pipeline_id === pipelineId)
    .map((row) => {
      const stage = stages.get(row.stage_id);
      return {
        id: row.id,
        company_name: row.company_name,
        pipeline_id: row.pipeline_id,
        stage_id: row.stage_id,
        stage_nome: stage?.nome ?? "Etapa",
        canonical_key: stage?.canonical_key ?? null,
        outcome: row.outcome,
        amount_cents: row.amount_cents,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });
  const dealIds = new Set(deals.map((row) => row.id));
  const activities: PainelActivityRow[] = store.crm_activities
    .filter((row) => dealIds.has(row.deal_id) && row.status === "open")
    .map((row) => ({
      deal_id: row.deal_id,
      kind: row.kind,
      due_at: row.due_at,
      status: row.status,
    }));
  const outcomeEvents: PainelOutcomeEvent[] = store.crm_events
    .filter((row) => dealIds.has(row.deal_id) && row.kind === "outcome")
    .map((row) => ({
      deal_id: row.deal_id,
      created_at: row.created_at,
      outcome: mapOutcomeEvent(row.meta.outcome),
    }));
  const profile = store.profiles.find((row) => row.id === userId);
  const aggregated = aggregatePainel({
    now,
    range: filters.range,
    pipelineId,
    callGoal: profile?.meta_ligacoes_dia || DEFAULT_CALL_GOAL,
    callCreatedAt: store.call_events
      .filter((row) => row.user_id === userId)
      .map((row) => row.created_at),
    searches: store.searches
      .filter((row) => row.user_id === userId)
      .map((row) => ({ created_at: row.created_at, saved: row.saved })),
    leads: store.saved_leads
      .filter((row) => row.user_id === userId)
      .map((row) => ({ status: row.status })),
    pipelines,
    deals,
    activities,
    outcomeEvents,
  });
  return {
    ...aggregated,
    suggestedPipelineId:
      pickDefaultCrmPipeline(
        pipelines.map((row) => ({ ...row, deal_count: row.openDeals })),
      )?.id ?? null,
  };
}

export async function loadPainelMetrics(
  userId: string,
  filters: PainelFilters,
  now = new Date(),
): Promise<PainelMetrics> {
  const balance = await getBalance(userId);
  const crmAllowed = balance.enrichAllowed;
  const trialExpired = balance.trialExpired;

  let core: Omit<PainelMetrics, "crmAllowed" | "trialExpired">;
  if (getDataSource() === "supabase") {
    if (!hasLiveDatabase()) {
      throw new PainelDataError("Banco indisponível para o painel.");
    }
    try {
      core = await loadPainelMetricsPg(userId, filters, now);
    } catch (err) {
      throw new PainelDataError(
        err instanceof Error ? err.message : "Não foi possível carregar os números",
        500,
      );
    }
  } else {
    core = loadPainelMetricsMock(userId, filters, now);
  }

  if (!crmAllowed) {
    return emptyPainelMetrics({
      range: filters.range,
      pipelineId: filters.pipelineId ?? null,
      suggestedPipelineId: core.suggestedPipelineId,
      crmAllowed: false,
      trialExpired,
      pipelines: core.pipelines,
      callGoal: core.kpis.callGoal,
      callsToday: core.kpis.callsToday,
      streak: core.kpis.streak,
      lists: core.lists,
      habit: core.habit,
    });
  }

  return { ...core, crmAllowed: true, trialExpired };
}
