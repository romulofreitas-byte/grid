import { allQueries, isUndefinedTableError, pgErrorCode, query } from "@/lib/data/pg";
import { hasLiveDatabase } from "@/lib/data";
import { getBillingMe, getBillingStore } from "@/lib/billing/service";
import {
  aggregateOpsCohorts,
  classifyOpsCohort,
  effectivePlanSku,
  type OpsUserSnapshot,
} from "@/lib/ops/classify";
import { isOpsProfileId } from "@/lib/ops/ids";
import type {
  OpsCredits,
  OpsMetrics,
  OpsRevenue,
  OpsUsageCounts,
  OpsUserDetail,
  OpsUserListItem,
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

async function scalarInt(text: string, params?: unknown[]): Promise<number> {
  const { rows } = await query<{ n: string | number | null }>(text, params);
  return Number(rows[0]?.n ?? 0) || 0;
}

async function optionalInt(text: string, params?: unknown[]): Promise<number> {
  try {
    return await scalarInt(text, params);
  } catch (err) {
    if (isUndefinedTableError(err)) return 0;
    throw err;
  }
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
};

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

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
    credits: Number(row.credits ?? row.cached_credits ?? 0) || 0,
    activated: snap.activated,
    ltvCents: Number(row.ltv_cents ?? 0) || 0,
    createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
    periodEndsAt: iso(row.period_end),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

const USER_FROM = `
  from profiles p
  left join lateral (
    select s.plan, s.status, s.current_period_end, s.cancel_at_period_end
    from billing_subscriptions s
    where s.profile_id = p.id
      and s.status in ('active', 'trialing')
      and s.current_period_end > now()
    order by s.current_period_end desc
    limit 1
  ) live on true
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

async function loadProfileFallback(q?: string): Promise<UserRow[]> {
  const needle = q?.trim() ?? "";
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
    needle
      ? `select id, nome, empresa_usuario as empresa, especialidade,
               cidade_usuario as cidade, plano as cached_plan, creditos as cached_credits,
               onboarding_completed_at, created_at
         from profiles
         where nome ilike $1 or empresa_usuario ilike $1
         order by created_at desc
         limit 200`
      : `select id, nome, empresa_usuario as empresa, especialidade,
               cidade_usuario as cidade, plano as cached_plan, creditos as cached_credits,
               onboarding_completed_at, created_at
         from profiles
         order by created_at desc
         limit 200`,
    needle ? [`%${needle}%`] : undefined,
  );
  return rows.map((row) => ({
    ...row,
    live_plan: null,
    live_status: null,
    period_end: null,
    cancel_at_period_end: null,
    ltv_cents: 0,
    credits: row.cached_credits,
    email: null,
  }));
}

async function loadUserRowsOnce(withEmail: boolean, q?: string): Promise<UserRow[]> {
  const needle = q?.trim() ?? "";
  const base = userSelect(withEmail);
  if (!needle) {
    return queryUsers(`${base} order by p.created_at desc limit 200`);
  }
  const like = `%${needle}%`;
  if (withEmail) {
    return queryUsers(
      `${base}
       where p.nome ilike $1
          or p.empresa_usuario ilike $1
          or u.email ilike $1
       order by p.created_at desc
       limit 200`,
      [like],
    );
  }
  return queryUsers(
    `${base}
     where p.nome ilike $1 or p.empresa_usuario ilike $1
     order by p.created_at desc
     limit 200`,
    [like],
  );
}

async function loadUserRows(q?: string): Promise<UserRow[]> {
  try {
    return await loadUserRowsOnce(await canJoinAuthUsers(), q);
  } catch (err) {
    const code = pgErrorCode(err);
    if (code === "42501") {
      authUsersJoin = false;
      try {
        return await loadUserRowsOnce(false, q);
      } catch (inner) {
        if (isUndefinedTableError(inner)) return loadProfileFallback(q);
        throw inner;
      }
    }
    if (isUndefinedTableError(err)) return loadProfileFallback(q);
    throw err;
  }
}

async function loadRevenue(): Promise<OpsRevenue> {
  try {
    const { rows } = await query<{
      total: string | number | null;
      last30: string | number | null;
      month: string | number | null;
    }>(
      `select
         coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::int as total,
         coalesce(sum(amount_cents) filter (
           where status = 'paid' and paid_at >= now() - interval '30 days'
         ), 0)::int as last30,
         coalesce(sum(amount_cents) filter (
           where status = 'paid'
             and paid_at >= (
               date_trunc('month', timezone('America/Sao_Paulo', now()))
               at time zone 'America/Sao_Paulo'
             )
         ), 0)::int as month
       from billing_orders`,
    );
    const row = rows[0];
    return {
      totalCents: Number(row?.total ?? 0) || 0,
      last30dCents: Number(row?.last30 ?? 0) || 0,
      monthCents: Number(row?.month ?? 0) || 0,
    };
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return { totalCents: 0, last30dCents: 0, monthCents: 0 };
    }
    throw err;
  }
}

async function loadCredits(): Promise<OpsCredits> {
  const [remaining, spent] = await allQueries<[number, number]>([
    () =>
      optionalInt(
        `select coalesce(sum(remaining), 0)::int as n
         from credit_lots
         where remaining > 0
           and (expires_at is null or expires_at > now())`,
      ),
    () =>
      optionalInt(
        `select coalesce(sum(amount), 0)::int as n
         from credit_ledger
         where type = 'debit'`,
      ),
  ]);
  return { remaining, spent };
}

async function loadUsage(): Promise<OpsUsageCounts> {
  const [
    searchesTotal,
    searches7d,
    enrichTotal,
    enrich7d,
    callsTotal,
    calls7d,
  ] = await allQueries<
    [number, number, number, number, number, number]
  >([
    () => optionalInt("select count(*)::int as n from searches"),
    () =>
      optionalInt(
        "select count(*)::int as n from searches where created_at > now() - interval '7 days'",
      ),
    () => optionalInt("select count(*)::int as n from enrichment_jobs"),
    () =>
      optionalInt(
        "select count(*)::int as n from enrichment_jobs where created_at > now() - interval '7 days'",
      ),
    () => optionalInt("select count(*)::int as n from call_events"),
    () =>
      optionalInt(
        "select count(*)::int as n from call_events where created_at > now() - interval '7 days'",
      ),
  ]);
  return {
    searchesTotal,
    searches7d,
    enrichTotal,
    enrich7d,
    callsTotal,
    calls7d,
  };
}

export async function loadOpsMetrics(): Promise<OpsMetrics> {
  requireLiveDb();
  const [rows, revenue, credits, usage] = await allQueries<
    [UserRow[], OpsRevenue, OpsCredits, OpsUsageCounts]
  >([
    () => loadUserRows(),
    () => loadRevenue(),
    () => loadCredits(),
    () => loadUsage(),
  ]);
  const cohorts = aggregateOpsCohorts(rows.map(snapshotFromRow));
  return {
    ...cohorts,
    revenue,
    credits,
    usage,
  };
}

export async function listOpsUsers(q?: string): Promise<OpsUserListItem[]> {
  requireLiveDb();
  const rows = await loadUserRows(q);
  return rows.map(listItemFromRow);
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
