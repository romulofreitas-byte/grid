import {
  allQueries,
  isUndefinedColumnError,
  isUndefinedTableError,
  pgErrorCode,
  query,
} from "@/lib/data/pg";
import { hasLiveDatabase } from "@/lib/data";
import { getBillingMe, getBillingStore } from "@/lib/billing/service";
import {
  classifyOpsCohort,
  effectivePlanSku,
  type OpsUserSnapshot,
} from "@/lib/ops/classify";
import { isOpsProfileId } from "@/lib/ops/ids";
import {
  DEFAULT_OPS_FILTERS,
  OPS_USERS_PAGE_SIZE,
  type OpsDashboardFilters,
} from "@/lib/ops/filters";
import { EMPTY_FUNNEL, funnelFromCounts } from "@/lib/ops/funnel";
import {
  beginScoped,
  cnaeDigitsSql,
  daysCte,
  LIVE_SUB_JOIN,
  periodSql,
  testerExcludeSql,
} from "@/lib/ops/sql";
import type {
  OpsCredits,
  OpsDayCohort,
  OpsMetrics,
  OpsPackMix,
  OpsRechargeStats,
  OpsRevenue,
  OpsRevenueDay,
  OpsUsageCounts,
  OpsUsageDay,
  OpsUserDetail,
  OpsUserListItem,
  OpsUserListPage,
} from "@/lib/ops/types";

export { isOpsProfileId };

export class OpsDataError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "OpsDataError";
    this.status = status;
  }
}

function requireLiveDb(): void {
  if (!hasLiveDatabase()) {
    throw new OpsDataError("Banco indisponível para o painel ops.");
  }
}

function num(value: unknown): number {
  return Number(value ?? 0) || 0;
}

function dayStr(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function optionalRows<T extends Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  try {
    const { rows } = await query<T>(text, params);
    return rows;
  } catch (err) {
    if (isUndefinedTableError(err) || isUndefinedColumnError(err)) return [];
    throw err;
  }
}

function emptyMetrics(range: OpsDashboardFilters["range"]): OpsMetrics {
  return {
    range,
    users: 0,
    active: 0,
    trial: 0,
    free: 0,
    activated: 0,
    byPlan: {},
    mrrCents: 0,
    canceling: 0,
    pastDue: 0,
    revenue: {
      totalCents: 0,
      periodCents: 0,
      last30dCents: 0,
      monthCents: 0,
      byKind: [],
    },
    credits: {
      remaining: 0,
      spent: 0,
      spentPeriod: 0,
      packRemaining: 0,
      packSpentPeriod: 0,
      bySource: [],
      debitByReason: [],
    },
    usage: {
      searchesTotal: 0,
      searchesPeriod: 0,
      enrichTotal: 0,
      enrichPeriod: 0,
      callsTotal: 0,
      callsPeriod: 0,
    },
    funnel: EMPTY_FUNNEL,
    signups: [],
    niches: [],
    segments: [],
    ufs: [],
    nicheUf: [],
    cnaes: [],
    cnaeEnrich: [],
    cnaeCalls: [],
    intentSearches: 0,
    enrichSeries: [],
    packs: [],
    recharge: {
      users: 0,
      orders: 0,
      cents: 0,
      activeUsers: 0,
      activeRecharged: 0,
      enrichRecharged: 0,
      enrichNotRecharged: 0,
      usersRecharged: 0,
      usersNotRecharged: 0,
    },
    revenueSeries: [],
    usageSeries: [],
    jobStatus: [],
  };
}

let authUsersJoin: boolean | null = null;

async function canJoinAuthUsers(): Promise<boolean> {
  if (authUsersJoin !== null) return authUsersJoin;
  try {
    const { rows } = await query<{ t: string | null }>(
      "select to_regclass('auth.users') as t",
    );
    authUsersJoin = Boolean(rows[0]?.t);
  } catch {
    authUsersJoin = false;
  }
  return authUsersJoin;
}

type UserRow = {
  id: string;
  nome: string | null;
  empresa: string | null;
  especialidade: string | null;
  cidade: string | null;
  cached_plan: string | null;
  cached_credits: number | string | null;
  onboarding_completed_at: Date | string | null;
  created_at: Date | string;
  live_plan: string | null;
  live_status: string | null;
  period_end: Date | string | null;
  cancel_at_period_end: boolean | null;
  ltv_cents: number | string | null;
  credits: number | string | null;
  email: string | null;
  recharged?: boolean | null;
  enrich_period?: number | string | null;
};

function snapshotFromRow(row: UserRow): OpsUserSnapshot {
  return {
    livePlan: row.live_plan,
    liveStatus: row.live_status,
    cachedPlan: row.cached_plan,
    activated: Boolean(row.onboarding_completed_at),
  };
}

function listItemFromRow(row: UserRow): OpsUserListItem {
  const snap = snapshotFromRow(row);
  const cohort = classifyOpsCohort(snap);
  return {
    id: String(row.id),
    email: row.email,
    nome: row.nome,
    empresa: row.empresa,
    plan: effectivePlanSku(snap),
    cohort,
    status: row.live_status,
    credits: num(row.credits ?? row.cached_credits),
    activated: snap.activated,
    ltvCents: num(row.ltv_cents),
    createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
    periodEndsAt: iso(row.period_end),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    recharged: Boolean(row.recharged),
    enrichInPeriod: num(row.enrich_period),
  };
}

const USER_FROM = `
  from profiles p
  ${LIVE_SUB_JOIN}
  left join lateral (
    select coalesce(sum(o.amount_cents), 0)::int as ltv_cents
    from billing_orders o
    where o.profile_id = p.id and o.status = 'paid'
  ) ltv on true
  left join lateral (
    select coalesce(sum(l.remaining), 0)::int as remaining
    from credit_lots l
    where l.profile_id = p.id
      and l.remaining > 0
      and (l.expires_at is null or l.expires_at > now())
  ) lots on true
`;

function userSelect(withEmail: boolean): string {
  const emailCol = withEmail ? "u.email" : "null::text";
  const emailJoin = withEmail ? "left join auth.users u on u.id = p.id" : "";
  return `
    select
      p.id,
      p.nome,
      p.empresa_usuario as empresa,
      p.especialidade,
      p.cidade_usuario as cidade,
      p.plano as cached_plan,
      p.creditos as cached_credits,
      p.onboarding_completed_at,
      p.created_at,
      live.plan as live_plan,
      live.status as live_status,
      live.current_period_end as period_end,
      live.cancel_at_period_end,
      coalesce(ltv.ltv_cents, 0) as ltv_cents,
      coalesce(lots.remaining, p.creditos, 0) as credits,
      ${emailCol} as email
    ${USER_FROM}
    ${emailJoin}
  `;
}

async function queryUsers(sql: string, params?: unknown[]): Promise<UserRow[]> {
  const { rows } = await query<UserRow>(sql, params);
  return rows;
}

async function loadUserRow(id: string): Promise<UserRow | null> {
  try {
    const withEmail = await canJoinAuthUsers();
    const rows = await queryUsers(
      `${userSelect(withEmail)} where p.id = $1 limit 1`,
      [id],
    );
    return rows[0] ?? null;
  } catch (err) {
    const code = pgErrorCode(err);
    if (code === "42501") {
      authUsersJoin = false;
      const rows = await queryUsers(
        `${userSelect(false)} where p.id = $1 limit 1`,
        [id],
      );
      return rows[0] ?? null;
    }
    if (isUndefinedTableError(err)) {
      const { rows } = await query<{
        id: string;
        nome: string | null;
        empresa: string | null;
        especialidade: string | null;
        cidade: string | null;
        cached_plan: string | null;
        cached_credits: number | string | null;
        onboarding_completed_at: Date | string | null;
        created_at: Date | string;
      }>(
        `select id, nome, empresa_usuario as empresa, especialidade,
                cidade_usuario as cidade, plano as cached_plan, creditos as cached_credits,
                onboarding_completed_at, created_at
         from profiles where id = $1 limit 1`,
        [id],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        ...row,
        live_plan: null,
        live_status: null,
        period_end: null,
        cancel_at_period_end: null,
        ltv_cents: 0,
        credits: row.cached_credits,
        email: null,
      };
    }
    throw err;
  }
}

export async function getOpsUser(id: string): Promise<OpsUserDetail | null> {
  requireLiveDb();
  if (!isOpsProfileId(id)) return null;
  const row = await loadUserRow(id);
  if (!row) return null;
  const item = listItemFromRow(row);
  const [searches, enrich, calls, savedLeads] = await allQueries<
    [number, number, number, number]
  >([
    () => optionalInt("select count(*)::int as n from searches where user_id = $1", [id]),
    () =>
      optionalInt(
        "select count(*)::int as n from enrichment_jobs where requested_by = $1",
        [id],
      ),
    () =>
      optionalInt("select count(*)::int as n from call_events where user_id = $1", [id]),
    () =>
      optionalInt("select count(*)::int as n from saved_leads where user_id = $1", [id]),
  ]);
  const billing = await getBillingMe(id);
  const store = await getBillingStore();
  const lots = await store.listOpenLots(id);
  const platformTrialUsed = billing.orders.some(
    (order) => order.kind === "platform" && order.status === "paid",
  );
  return {
    ...item,
    especialidade: row.especialidade,
    cidade: row.cidade,
    onboardingCompletedAt: iso(row.onboarding_completed_at),
    platformTrialUsed,
    usage: { searches, enrich, calls, savedLeads },
    balance: billing.balance,
    subscription: billing.subscription,
    orders: billing.orders,
    ledger: billing.ledger,
    lots,
  };
}

async function optionalInt(text: string, params?: unknown[]): Promise<number> {
  try {
    const { rows } = await query<{ n: string | number | null }>(text, params);
    return num(rows[0]?.n);
  } catch (err) {
    if (isUndefinedTableError(err) || isUndefinedColumnError(err)) return 0;
    throw err;
  }
}

type SnapshotRow = {
  users: string | number | null;
  active: string | number | null;
  trial: string | number | null;
  free: string | number | null;
  activated: string | number | null;
  mrr_cents: string | number | null;
  canceling: string | number | null;
  recharged_users: string | number | null;
  active_recharged: string | number | null;
};

function scoped(filters: OpsDashboardFilters) {
  return beginScoped(filters, { withEmail: authUsersJoin !== false });
}

async function loadSnapshot(filters: OpsDashboardFilters) {
  const { params, cte } = scoped(filters);
  const [snap, plans, pastDue] = await allQueries<
    [SnapshotRow[], { sku: string; n: string | number }[], { n: string | number | null }[]]
  >([
    () =>
      optionalRows<SnapshotRow>(
        `with ${cte}
         select
           count(*)::int as users,
           count(*) filter (where cohort = 'active')::int as active,
           count(*) filter (where cohort = 'trial')::int as trial,
           count(*) filter (where cohort = 'free')::int as free,
           count(*) filter (where activated)::int as activated,
           coalesce(sum(mrr_cents), 0)::int as mrr_cents,
           count(*) filter (where cancel_at_period_end)::int as canceling,
           count(*) filter (where recharged)::int as recharged_users,
           count(*) filter (where cohort = 'active' and recharged)::int as active_recharged
         from scoped_users`,
        params.values,
      ),
    () =>
      optionalRows<{ sku: string; n: string | number }>(
        `with ${cte}
         select plan as sku, count(*)::int as n
         from scoped_users
         group by plan
         order by n desc`,
        params.values,
      ),
    () =>
      optionalRows<{ n: string | number | null }>(
        `with ${cte}
         select count(*)::int as n
         from billing_subscriptions s
         join scoped_users u on u.id = s.profile_id
         where s.status = 'past_due'`,
        params.values,
      ),
  ]);
  const row = snap[0];
  const byPlan: Record<string, number> = {};
  for (const plan of plans) byPlan[plan.sku] = num(plan.n);
  return {
    users: num(row?.users),
    active: num(row?.active),
    trial: num(row?.trial),
    free: num(row?.free),
    activated: num(row?.activated),
    mrrCents: num(row?.mrr_cents),
    canceling: num(row?.canceling),
    byPlan,
    rechargeUsers: num(row?.recharged_users),
    activeRecharged: num(row?.active_recharged),
    pastDue: num(pastDue[0]?.n),
  };
}

async function loadRevenue(filters: OpsDashboardFilters): Promise<OpsRevenue> {
  const { params, cte } = scoped(filters);
  const [totals, byKind] = await allQueries<
    [
      {
        total: string | number | null;
        period: string | number | null;
        last30: string | number | null;
        month: string | number | null;
      }[],
      { kind: string; cents: string | number }[],
    ]
  >([
    () =>
      optionalRows(
        `with ${cte}
         select
           coalesce(sum(o.amount_cents) filter (where o.status = 'paid'), 0)::int as total,
           coalesce(sum(o.amount_cents) filter (
             where o.status = 'paid' and ${periodSql("o.paid_at", filters.range)}
           ), 0)::int as period,
           coalesce(sum(o.amount_cents) filter (
             where o.status = 'paid' and o.paid_at >= now() - interval '30 days'
           ), 0)::int as last30,
           coalesce(sum(o.amount_cents) filter (
             where o.status = 'paid'
               and o.paid_at >= (
                 date_trunc('month', timezone('America/Sao_Paulo', now()))
                 at time zone 'America/Sao_Paulo'
               )
           ), 0)::int as month
         from billing_orders o
         join scoped_users u on u.id = o.profile_id`,
        params.values,
      ),
    () =>
      optionalRows<{ kind: string; cents: string | number }>(
        `with ${cte}
         select o.kind, coalesce(sum(o.amount_cents), 0)::int as cents
         from billing_orders o
         join scoped_users u on u.id = o.profile_id
         where o.status = 'paid' and ${periodSql("o.paid_at", filters.range)}
         group by o.kind
         order by cents desc`,
        params.values,
      ),
  ]);
  const row = totals[0];
  return {
    totalCents: num(row?.total),
    periodCents: num(row?.period),
    last30dCents: num(row?.last30),
    monthCents: num(row?.month),
    byKind: byKind.map((item) => ({ kind: item.kind, cents: num(item.cents) })),
  };
}

async function loadCredits(filters: OpsDashboardFilters): Promise<OpsCredits> {
  const { params, cte } = scoped(filters);
  const [bySource, spent, spentPeriod, debitByReason, packSpent] = await allQueries<
    [
      { source: string; remaining: string | number }[],
      { n: string | number | null }[],
      { n: string | number | null }[],
      { reason: string; amount: string | number }[],
      { n: string | number | null }[],
    ]
  >([
    () =>
      optionalRows<{ source: string; remaining: string | number }>(
        `with ${cte}
         select l.source, coalesce(sum(l.remaining), 0)::int as remaining
         from credit_lots l
         join scoped_users u on u.id = l.profile_id
         where l.remaining > 0
           and (l.expires_at is null or l.expires_at > now())
         group by l.source`,
        params.values,
      ),
    () =>
      optionalRows<{ n: string | number | null }>(
        `with ${cte}
         select coalesce(sum(e.amount), 0)::int as n
         from credit_ledger e
         join scoped_users u on u.id = e.profile_id
         where e.type = 'debit'`,
        params.values,
      ),
    () =>
      optionalRows<{ n: string | number | null }>(
        `with ${cte}
         select coalesce(sum(e.amount), 0)::int as n
         from credit_ledger e
         join scoped_users u on u.id = e.profile_id
         where e.type = 'debit' and ${periodSql("e.created_at", filters.range)}`,
        params.values,
      ),
    () =>
      optionalRows<{ reason: string; amount: string | number }>(
        `with ${cte}
         select
           case
             when e.reason in ('enrich', 'export') then e.reason
             else 'other'
           end as reason,
           coalesce(sum(e.amount), 0)::int as amount
         from credit_ledger e
         join scoped_users u on u.id = e.profile_id
         where e.type = 'debit' and ${periodSql("e.created_at", filters.range)}
         group by 1
         order by amount desc`,
        params.values,
      ),
    () =>
      optionalRows<{ n: string | number | null }>(
        `with ${cte}
         select coalesce(sum(e.amount), 0)::int as n
         from credit_ledger e
         join credit_lots l on l.id = e.lot_id
         join scoped_users u on u.id = e.profile_id
         where e.type = 'debit'
           and l.source = 'pack'
           and ${periodSql("e.created_at", filters.range)}`,
        params.values,
      ),
  ]);
  const remainingRows = bySource.map((row) => ({
    source: row.source,
    remaining: num(row.remaining),
  }));
  return {
    remaining: remainingRows.reduce((sum, row) => sum + row.remaining, 0),
    spent: num(spent[0]?.n),
    spentPeriod: num(spentPeriod[0]?.n),
    packRemaining: remainingRows
      .filter((row) => row.source === "pack")
      .reduce((sum, row) => sum + row.remaining, 0),
    packSpentPeriod: num(packSpent[0]?.n),
    bySource: remainingRows,
    debitByReason: debitByReason.map((row) => ({
      reason: row.reason,
      amount: num(row.amount),
    })),
  };
}

async function loadUsage(filters: OpsDashboardFilters): Promise<OpsUsageCounts> {
  const { params, cte } = scoped(filters);
  const [searchesTotal, searchesPeriod, enrichTotal, enrichPeriod, callsTotal, callsPeriod] =
    await allQueries<[number, number, number, number, number, number]>([
      () =>
        optionalInt(
          `with ${cte}
           select count(*)::int as n
           from searches s
           join scoped_users u on u.id = s.user_id`,
          params.values,
        ),
      () =>
        optionalInt(
          `with ${cte}
           select count(*)::int as n
           from searches s
           join scoped_users u on u.id = s.user_id
           where ${periodSql("s.created_at", filters.range)}`,
          params.values,
        ),
      () =>
        optionalInt(
          `with ${cte}
           select count(*)::int as n
           from enrichment_jobs e
           join scoped_users u on u.id = e.requested_by`,
          params.values,
        ),
      () =>
        optionalInt(
          `with ${cte}
           select count(*)::int as n
           from enrichment_jobs e
           join scoped_users u on u.id = e.requested_by
           where ${periodSql("e.created_at", filters.range)}`,
          params.values,
        ),
      () =>
        optionalInt(
          `with ${cte}
           select count(*)::int as n
           from call_events c
           join scoped_users u on u.id = c.user_id`,
          params.values,
        ),
      () =>
        optionalInt(
          `with ${cte}
           select count(*)::int as n
           from call_events c
           join scoped_users u on u.id = c.user_id
           where ${periodSql("c.created_at", filters.range)}`,
          params.values,
        ),
    ]);
  return {
    searchesTotal,
    searchesPeriod,
    enrichTotal,
    enrichPeriod,
    callsTotal,
    callsPeriod,
  };
}

async function loadFunnel(filters: OpsDashboardFilters) {
  const { params, cte } = scoped(filters);
  const rows = await optionalRows<{
    signed_up: string | number | null;
    activated: string | number | null;
    searched: string | number | null;
    qualified: string | number | null;
    paid: string | number | null;
    recharged: string | number | null;
  }>(
    `with ${cte},
     cohort as (
       select * from scoped_users
       where ${periodSql("created_at", filters.range)}
     )
     select
       count(*)::int as signed_up,
       count(*) filter (where activated)::int as activated,
       count(*) filter (where exists (
         select 1 from searches s where s.user_id = cohort.id
       ))::int as searched,
       count(*) filter (where exists (
         select 1 from enrichment_jobs e where e.requested_by = cohort.id
       ))::int as qualified,
       count(*) filter (where exists (
         select 1 from billing_orders o
         where o.profile_id = cohort.id
           and o.status = 'paid'
           and o.kind in ('subscription_cycle', 'credit_pack')
       ))::int as paid,
       count(*) filter (where exists (
         select 1 from billing_orders o
         where o.profile_id = cohort.id
           and o.status = 'paid'
           and o.kind = 'credit_pack'
       ))::int as recharged
     from cohort`,
    params.values,
  );
  const row = rows[0];
  return funnelFromCounts({
    signedUp: num(row?.signed_up),
    activated: num(row?.activated),
    searched: num(row?.searched),
    qualified: num(row?.qualified),
    paid: num(row?.paid),
    recharged: num(row?.recharged),
  });
}

async function loadSignups(filters: OpsDashboardFilters): Promise<OpsDayCohort[]> {
  const { params, cte } = scoped(filters);
  const rows = await optionalRows<{
    day: string | Date;
    active: string | number | null;
    trial: string | number | null;
    free: string | number | null;
  }>(
    `with ${cte},
     ${daysCte(filters.range)}
     select
       days.day::text as day,
       count(*) filter (where u.cohort = 'active')::int as active,
       count(*) filter (where u.cohort = 'trial')::int as trial,
       count(*) filter (where u.cohort = 'free')::int as free
     from days
     left join scoped_users u
       on (timezone('America/Sao_Paulo', u.created_at))::date = days.day
     group by days.day
     order by days.day`,
    params.values,
  );
  return rows.map((row) => ({
    day: dayStr(row.day),
    active: num(row.active),
    trial: num(row.trial),
    free: num(row.free),
  }));
}

function mapCnaeRows(
  rows: { codigo: string; nome: string; count: string | number }[],
): { codigo: string; nome: string; count: number }[] {
  return rows.map((row) => ({
    codigo: String(row.codigo ?? "").trim(),
    nome: row.nome?.trim() || String(row.codigo ?? "").trim(),
    count: num(row.count),
  }));
}

async function loadMarket(filters: OpsDashboardFilters) {
  const { params, cte } = scoped(filters);
  const inPeriod = periodSql("s.created_at", filters.range);
  const fromSearches = `
    from searches s
    join scoped_users u on u.id = s.user_id
  `;
  const cnaeCodigo = cnaeDigitsSql("cnae.code");
  const [niches, segments, ufs, nicheUf, intent, cnaes, cnaeEnrich, cnaeCalls] =
    await allQueries<
      [
        { id: string; nome: string; count: string | number }[],
        { id: string; nome: string; count: string | number }[],
        { uf: string; count: string | number }[],
        { niche_id: string; niche_nome: string; uf: string; count: string | number }[],
        { n: string | number | null }[],
        { codigo: string; nome: string; count: string | number }[],
        { codigo: string; nome: string; count: string | number }[],
        { codigo: string; nome: string; count: string | number }[],
      ]
    >([
    () =>
      optionalRows(
        `with ${cte}
         select
           coalesce(parent.id, np.id)::text as id,
           coalesce(parent.nome, np.nome) as nome,
           count(*)::int as count
         ${fromSearches}
         cross join lateral jsonb_array_elements_text(
           coalesce(s.filtros->'segmentIds', '[]'::jsonb)
         ) seg(id)
         join niche_presets np on np.id::text = seg.id
         left join niche_presets parent on parent.id = np.parent_id
         where ${inPeriod}
         group by 1, 2
         order by count desc, nome
         limit 15`,
        params.values,
      ),
    () =>
      optionalRows(
        `with ${cte}
         select np.id::text as id, np.nome, count(*)::int as count
         ${fromSearches}
         cross join lateral jsonb_array_elements_text(
           coalesce(s.filtros->'segmentIds', '[]'::jsonb)
         ) seg(id)
         join niche_presets np on np.id::text = seg.id
         where ${inPeriod}
         group by np.id, np.nome
         order by count desc, np.nome
         limit 15`,
        params.values,
      ),
    () =>
      optionalRows(
        `with ${cte}
         select uf.code as uf, count(*)::int as count
         ${fromSearches}
         cross join lateral jsonb_array_elements_text(
           coalesce(s.filtros->'ufs', '[]'::jsonb)
         ) uf(code)
         where ${inPeriod} and uf.code <> ''
         group by uf.code
         order by count desc, uf.code`,
        params.values,
      ),
    () =>
      optionalRows(
        `with ${cte}
         select
           coalesce(parent.id, np.id)::text as niche_id,
           coalesce(parent.nome, np.nome) as niche_nome,
           uf.code as uf,
           count(*)::int as count
         ${fromSearches}
         cross join lateral jsonb_array_elements_text(
           coalesce(s.filtros->'segmentIds', '[]'::jsonb)
         ) seg(id)
         join niche_presets np on np.id::text = seg.id
         left join niche_presets parent on parent.id = np.parent_id
         cross join lateral jsonb_array_elements_text(
           coalesce(s.filtros->'ufs', '[]'::jsonb)
         ) uf(code)
         where ${inPeriod} and uf.code <> ''
         group by 1, 2, 3
         order by count desc
         limit 40`,
        params.values,
      ),
    () =>
      optionalRows<{ n: string | number | null }>(
        `with ${cte}
         select count(*)::int as n
         ${fromSearches}
         where ${inPeriod}
           and coalesce(s.filtros->'segmentIds', '[]'::jsonb) = '[]'::jsonb
           and coalesce(s.filtros->>'intentQuery', '') <> ''`,
        params.values,
      ),
    () =>
      optionalRows(
        `with ${cte},
         search_cnaes as (
           select ${cnaeCodigo} as codigo
           ${fromSearches}
           cross join lateral jsonb_array_elements_text(
             coalesce(s.filtros->'cnaes', '[]'::jsonb)
           ) cnae(code)
           where ${inPeriod}
             and regexp_replace(cnae.code, '[^0-9]', '', 'g') <> ''
           union all
           select npc.cnae as codigo
           ${fromSearches}
           cross join lateral jsonb_array_elements_text(
             coalesce(s.filtros->'segmentIds', '[]'::jsonb)
           ) seg(id)
           join niche_preset_cnaes npc
             on npc.preset_id::text = seg.id
            and npc.incluido
           where ${inPeriod}
             and coalesce(s.filtros->'cnaes', '[]'::jsonb) = '[]'::jsonb
         )
         select
           sc.codigo,
           coalesce(nullif(trim(rc.descricao), ''), sc.codigo) as nome,
           count(*)::int as count
         from search_cnaes sc
         left join ref_cnae rc on rc.codigo = sc.codigo
         where sc.codigo ~ '^[0-9]{7}$'
           and sc.codigo <> '0000000'
         group by 1, 2
         order by count desc, nome
         limit 15`,
        params.values,
      ),
    () =>
      optionalRows(
        `with ${cte}
         select
           es.cnae_principal as codigo,
           coalesce(nullif(trim(rc.descricao), ''), es.cnae_principal) as nome,
           count(*)::int as count
         from enrichment_jobs e
         join scoped_users u on u.id = e.requested_by
         join establishments es on es.cnpj = e.cnpj
         left join ref_cnae rc on rc.codigo = es.cnae_principal
         where ${periodSql("e.created_at", filters.range)}
           and nullif(trim(es.cnae_principal), '') is not null
         group by 1, 2
         order by count desc, nome
         limit 15`,
        params.values,
      ),
    () =>
      optionalRows(
        `with ${cte}
         select
           es.cnae_principal as codigo,
           coalesce(nullif(trim(rc.descricao), ''), es.cnae_principal) as nome,
           count(*)::int as count
         from call_events c
         join scoped_users u on u.id = c.user_id
         join establishments es on es.cnpj = c.cnpj
         left join ref_cnae rc on rc.codigo = es.cnae_principal
         where ${periodSql("c.created_at", filters.range)}
           and nullif(trim(es.cnae_principal), '') is not null
         group by 1, 2
         order by count desc, nome
         limit 15`,
        params.values,
      ),
  ]);
  return {
    niches: niches.map((row) => ({
      id: row.id,
      nome: row.nome,
      count: num(row.count),
    })),
    segments: segments.map((row) => ({
      id: row.id,
      nome: row.nome,
      count: num(row.count),
    })),
    ufs: ufs.map((row) => ({ uf: row.uf, count: num(row.count) })),
    nicheUf: nicheUf.map((row) => ({
      nicheId: row.niche_id,
      nicheNome: row.niche_nome,
      uf: row.uf,
      count: num(row.count),
    })),
    cnaes: mapCnaeRows(cnaes),
    cnaeEnrich: mapCnaeRows(cnaeEnrich),
    cnaeCalls: mapCnaeRows(cnaeCalls),
    intentSearches: num(intent[0]?.n),
  };
}

async function loadPacks(filters: OpsDashboardFilters): Promise<{
  packs: OpsPackMix[];
  recharge: Pick<OpsRechargeStats, "users" | "orders" | "cents">;
}> {
  const { params, cte } = scoped(filters);
  const [rows, totals] = await allQueries<
    [
      { sku: string; orders: string | number; users: string | number; cents: string | number }[],
      { users: string | number | null; orders: string | number | null; cents: string | number | null }[],
    ]
  >([
    () =>
      optionalRows(
        `with ${cte}
         select
           o.sku,
           count(*)::int as orders,
           count(distinct o.profile_id)::int as users,
           coalesce(sum(o.amount_cents), 0)::int as cents
         from billing_orders o
         join scoped_users u on u.id = o.profile_id
         where o.status = 'paid'
           and o.kind = 'credit_pack'
           and ${periodSql("o.paid_at", filters.range)}
         group by o.sku
         order by cents desc`,
        params.values,
      ),
    () =>
      optionalRows(
        `with ${cte}
         select
           count(distinct o.profile_id)::int as users,
           count(*)::int as orders,
           coalesce(sum(o.amount_cents), 0)::int as cents
         from billing_orders o
         join scoped_users u on u.id = o.profile_id
         where o.status = 'paid'
           and o.kind = 'credit_pack'
           and ${periodSql("o.paid_at", filters.range)}`,
        params.values,
      ),
  ]);
  return {
    packs: rows.map((row) => ({
      sku: row.sku,
      orders: num(row.orders),
      users: num(row.users),
      cents: num(row.cents),
    })),
    recharge: {
      users: num(totals[0]?.users),
      orders: num(totals[0]?.orders),
      cents: num(totals[0]?.cents),
    },
  };
}

async function loadQualifySplit(filters: OpsDashboardFilters) {
  const { params, cte } = scoped(filters);
  const rows = await optionalRows<{
    recharged: boolean;
    users: string | number;
    enrich: string | number;
  }>(
    `with ${cte}
     select
       u.recharged,
       count(distinct u.id)::int as users,
       count(e.id)::int as enrich
     from scoped_users u
     left join enrichment_jobs e
       on e.requested_by = u.id
      and ${periodSql("e.created_at", filters.range)}
     group by u.recharged`,
    params.values,
  );
  const yes = rows.find((row) => row.recharged);
  const no = rows.find((row) => !row.recharged);
  return {
    enrichRecharged: num(yes?.enrich),
    enrichNotRecharged: num(no?.enrich),
    usersRecharged: num(yes?.users),
    usersNotRecharged: num(no?.users),
  };
}

async function loadSeries(filters: OpsDashboardFilters): Promise<{
  usageSeries: OpsUsageDay[];
  revenueSeries: OpsRevenueDay[];
  enrichSeries: { day: string; count: number }[];
  jobStatus: { status: string; count: number }[];
}> {
  const { params, cte } = scoped(filters);
  const [usage, revenue, jobs] = await allQueries<
    [
      {
        day: string | Date;
        searches: string | number | null;
        enrich: string | number | null;
        calls: string | number | null;
      }[],
      {
        day: string | Date;
        subscription_cycle: string | number | null;
        credit_pack: string | number | null;
        platform: string | number | null;
      }[],
      { status: string; count: string | number }[],
    ]
  >([
    () =>
      optionalRows(
        `with ${cte},
         ${daysCte(filters.range)}
         select
           days.day::text as day,
           (
             select count(*)::int from searches s
             join scoped_users u on u.id = s.user_id
             where (timezone('America/Sao_Paulo', s.created_at))::date = days.day
           ) as searches,
           (
             select count(*)::int from enrichment_jobs e
             join scoped_users u on u.id = e.requested_by
             where (timezone('America/Sao_Paulo', e.created_at))::date = days.day
           ) as enrich,
           (
             select count(*)::int from call_events c
             join scoped_users u on u.id = c.user_id
             where (timezone('America/Sao_Paulo', c.created_at))::date = days.day
           ) as calls
         from days
         order by days.day`,
        params.values,
      ),
    () =>
      optionalRows(
        `with ${cte},
         ${daysCte(filters.range)}
         select
           days.day::text as day,
           coalesce(sum(o.amount_cents) filter (where o.kind = 'subscription_cycle'), 0)::int as subscription_cycle,
           coalesce(sum(o.amount_cents) filter (where o.kind = 'credit_pack'), 0)::int as credit_pack,
           coalesce(sum(o.amount_cents) filter (where o.kind = 'platform'), 0)::int as platform
         from days
         left join (
           select o.paid_at, o.kind, o.amount_cents
           from billing_orders o
           join scoped_users u on u.id = o.profile_id
           where o.status = 'paid'
         ) o on (timezone('America/Sao_Paulo', o.paid_at))::date = days.day
         group by days.day
         order by days.day`,
        params.values,
      ),
    () =>
      optionalRows<{ status: string; count: string | number }>(
        `with ${cte}
         select e.status, count(*)::int as count
         from enrichment_jobs e
         join scoped_users u on u.id = e.requested_by
         where ${periodSql("e.created_at", filters.range)}
         group by e.status
         order by count desc`,
        params.values,
      ),
  ]);
  const usageSeries = usage.map((row) => ({
    day: dayStr(row.day),
    searches: num(row.searches),
    enrich: num(row.enrich),
    calls: num(row.calls),
  }));
  return {
    usageSeries,
    revenueSeries: revenue.map((row) => ({
      day: dayStr(row.day),
      subscription_cycle: num(row.subscription_cycle),
      credit_pack: num(row.credit_pack),
      platform: num(row.platform),
    })),
    enrichSeries: usageSeries.map((row) => ({ day: row.day, count: row.enrich })),
    jobStatus: jobs.map((row) => ({ status: row.status, count: num(row.count) })),
  };
}

export async function loadOpsMetrics(
  filters: OpsDashboardFilters = DEFAULT_OPS_FILTERS,
): Promise<OpsMetrics> {
  requireLiveDb();
  await canJoinAuthUsers();
  const empty = emptyMetrics(filters.range);
  try {
    const [snapshot, revenue, credits, usage, funnel, signups, market, packs, split, series] =
      await allQueries<
        [
          Awaited<ReturnType<typeof loadSnapshot>>,
          OpsRevenue,
          OpsCredits,
          OpsUsageCounts,
          ReturnType<typeof funnelFromCounts>,
          OpsDayCohort[],
          Awaited<ReturnType<typeof loadMarket>>,
          Awaited<ReturnType<typeof loadPacks>>,
          Awaited<ReturnType<typeof loadQualifySplit>>,
          Awaited<ReturnType<typeof loadSeries>>,
        ]
      >([
        () => loadSnapshot(filters),
        () => loadRevenue(filters),
        () => loadCredits(filters),
        () => loadUsage(filters),
        () => loadFunnel(filters),
        () => loadSignups(filters),
        () => loadMarket(filters),
        () => loadPacks(filters),
        () => loadQualifySplit(filters),
        () => loadSeries(filters),
      ]);
    return {
      range: filters.range,
      users: snapshot.users,
      active: snapshot.active,
      trial: snapshot.trial,
      free: snapshot.free,
      activated: snapshot.activated,
      byPlan: snapshot.byPlan,
      mrrCents: snapshot.mrrCents,
      canceling: snapshot.canceling,
      pastDue: snapshot.pastDue,
      revenue,
      credits,
      usage,
      funnel,
      signups,
      niches: market.niches,
      segments: market.segments,
      ufs: market.ufs,
      nicheUf: market.nicheUf,
      cnaes: market.cnaes,
      cnaeEnrich: market.cnaeEnrich,
      cnaeCalls: market.cnaeCalls,
      intentSearches: market.intentSearches,
      enrichSeries: series.enrichSeries,
      packs: packs.packs,
      recharge: {
        ...packs.recharge,
        activeUsers: snapshot.active,
        activeRecharged: snapshot.activeRecharged,
        ...split,
      },
      revenueSeries: series.revenueSeries,
      usageSeries: series.usageSeries,
      jobStatus: series.jobStatus,
    };
  } catch (err) {
    if (isUndefinedTableError(err) || isUndefinedColumnError(err)) return empty;
    throw err;
  }
}

type ListInput = {
  q?: string;
  filters?: OpsDashboardFilters;
  limit?: number;
  offset?: number;
};

async function loadProfileFallback(input: ListInput): Promise<OpsUserListPage> {
  const needle = input.q?.trim() ?? "";
  const limit = input.limit ?? OPS_USERS_PAGE_SIZE;
  const offset = input.offset ?? 0;
  const { rows } = await query<{
    id: string;
    nome: string | null;
    empresa: string | null;
    especialidade: string | null;
    cidade: string | null;
    cached_plan: string | null;
    cached_credits: number | string | null;
    onboarding_completed_at: Date | string | null;
    created_at: Date | string;
    total: string | number;
  }>(
    needle
      ? `select p.id, p.nome, p.empresa_usuario as empresa, p.especialidade,
               p.cidade_usuario as cidade, p.plano as cached_plan, p.creditos as cached_credits,
               p.onboarding_completed_at, p.created_at,
               count(*) over() as total
         from profiles p
         where (${testerExcludeSql(false)})
           and (p.nome ilike $1 or p.empresa_usuario ilike $1)
         order by p.created_at desc
         limit $2 offset $3`
      : `select p.id, p.nome, p.empresa_usuario as empresa, p.especialidade,
               p.cidade_usuario as cidade, p.plano as cached_plan, p.creditos as cached_credits,
               p.onboarding_completed_at, p.created_at,
               count(*) over() as total
         from profiles p
         where ${testerExcludeSql(false)}
         order by p.created_at desc
         limit $1 offset $2`,
    needle ? [`%${needle}%`, limit, offset] : [limit, offset],
  );
  return {
    total: num(rows[0]?.total),
    users: rows.map((row) =>
      listItemFromRow({
        ...row,
        live_plan: null,
        live_status: null,
        period_end: null,
        cancel_at_period_end: null,
        ltv_cents: 0,
        credits: row.cached_credits,
        email: null,
      }),
    ),
  };
}

async function listOpsUsersOnce(
  withEmail: boolean,
  input: ListInput,
): Promise<OpsUserListPage> {
  const filters = input.filters ?? DEFAULT_OPS_FILTERS;
  const { params, cte } = scoped(filters);
  const needle = input.q?.trim() ?? "";
  const limit = input.limit ?? OPS_USERS_PAGE_SIZE;
  const offset = input.offset ?? 0;
  const like = needle ? params.add(`%${needle}%`) : null;
  const limitPh = params.add(limit);
  const offsetPh = params.add(offset);
  const emailCol = withEmail ? "au.email" : "null::text";
  const emailJoin = withEmail ? "left join auth.users au on au.id = p.id" : "";
  const searchWhere = needle
    ? withEmail
      ? `and (p.nome ilike ${like} or p.empresa_usuario ilike ${like} or au.email ilike ${like})`
      : `and (p.nome ilike ${like} or p.empresa_usuario ilike ${like})`
    : "";
  const sql = `
    with ${cte}
    select
      p.id,
      p.nome,
      p.empresa_usuario as empresa,
      p.especialidade,
      p.cidade_usuario as cidade,
      p.plano as cached_plan,
      p.creditos as cached_credits,
      p.onboarding_completed_at,
      p.created_at,
      su.live_plan,
      su.live_status,
      su.period_end,
      su.cancel_at_period_end,
      coalesce(ltv.ltv_cents, 0) as ltv_cents,
      coalesce(lots.remaining, p.creditos, 0) as credits,
      ${emailCol} as email,
      su.recharged,
      (
        select count(*)::int
        from enrichment_jobs e
        where e.requested_by = p.id
          and ${periodSql("e.created_at", filters.range)}
      ) as enrich_period,
      count(*) over() as total
    from scoped_users su
    join profiles p on p.id = su.id
    ${emailJoin}
    left join lateral (
      select coalesce(sum(o.amount_cents), 0)::int as ltv_cents
      from billing_orders o
      where o.profile_id = p.id and o.status = 'paid'
    ) ltv on true
    left join lateral (
      select coalesce(sum(l.remaining), 0)::int as remaining
      from credit_lots l
      where l.profile_id = p.id
        and l.remaining > 0
        and (l.expires_at is null or l.expires_at > now())
    ) lots on true
    where true
    ${searchWhere}
    order by p.created_at desc
    limit ${limitPh} offset ${offsetPh}
  `;
  const { rows } = await query<UserRow & { total: string | number }>(sql, params.values);
  return {
    total: num(rows[0]?.total),
    users: rows.map(listItemFromRow),
  };
}

export async function listOpsUsers(input: ListInput = {}): Promise<OpsUserListPage> {
  requireLiveDb();
  try {
    return await listOpsUsersOnce(await canJoinAuthUsers(), input);
  } catch (err) {
    const code = pgErrorCode(err);
    if (code === "42501") {
      authUsersJoin = false;
      try {
        return await listOpsUsersOnce(false, input);
      } catch (inner) {
        if (isUndefinedTableError(inner)) return loadProfileFallback(input);
        throw inner;
      }
    }
    if (isUndefinedTableError(err)) return loadProfileFallback(input);
    throw err;
  }
}
