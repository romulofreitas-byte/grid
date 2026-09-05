/**
 * Read-only production usage audit. Prints JSON. No writes.
 *   pnpm exec tsx scripts/audit/uso-real.ts
 */
import { Client } from "pg";
import { getDatabaseUrl } from "../ingest/config";

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const parsed = new URL(url);
  const host = parsed.hostname;
  const local =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  const maskedHost = host.replace(
    /([a-z0-9]{6})[a-z0-9-]+([a-z0-9]{4}\.[a-z.]+)$/i,
    "$1…$2",
  );

  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });

async function q<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[] | { _error: string; _code?: string }> {
  try {
    const r = await client.query(sql, params);
    return r.rows as T[];
  } catch (err) {
    const e = err as { message?: string; code?: string };
    return { _error: e.message ?? String(err), _code: e.code };
  }
}

async function exists(table: string): Promise<boolean> {
  const r = await q<{ ok: boolean }>(
    `select to_regclass($1) is not null as ok`,
    [`public.${table}`],
  );
  if (Array.isArray(r)) return Boolean(r[0]?.ok);
  return false;
}

await client.connect();

const tables = [
  "credit_ledger",
  "credit_lots",
  "billed_cnpjs",
  "billing_subscriptions",
  "billing_orders",
  "profiles",
  "crm_import_runs",
  "crm_inbound_endpoints",
  "crm_inbound_events",
  "crm_deals",
  "crm_events",
  "crm_activities",
  "crm_stages",
  "metas",
  "search_jobs",
  "user_catchup_state",
  "platform_subscribers",
  "usage_daily",
  "integration_connections",
] as const;

const tableFlags: Record<string, boolean> = {};
for (const t of tables) tableFlags[t] = await exists(t);

const out = {
  ok: true,
  queried_at: new Date().toISOString(),
  db: {
    host: maskedHost,
    port: parsed.port || "5432",
    local,
    name: parsed.pathname.replace("/", ""),
  },
  tables: tableFlags,
  schema_migrations: await q(
    `select version from supabase_migrations.schema_migrations order by version`,
  ),
  public_tables: await q(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  ),
  crm_deals_cols: await q(
    `select column_name, data_type
     from information_schema.columns
     where table_schema = 'public' and table_name = 'crm_deals'
     order by ordinal_position`,
  ),
  crm_stages_cols: await q(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'crm_stages'
     order by ordinal_position`,
  ),
  profiles_cols: await q(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
     order by ordinal_position`,
  ),
  inbound_endpoint_cols: await q(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'crm_inbound_endpoints'
     order by ordinal_position`,
  ),
  lead_enrichment_cols: await q(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'lead_enrichment'
     order by ordinal_position`,
  ),
  enrichment_jobs_cols: await q(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'enrichment_jobs'
     order by ordinal_position`,
  ),
  ledger_debit: await q(
    `select reason, count(*)::int as entries, coalesce(sum(amount),0)::int as credits
     from credit_ledger where type = 'debit'
     group by reason order by credits desc`,
  ),
  billed_cnpjs: await q(
    `select kind, count(*)::int as n, count(distinct profile_id)::int as accounts
     from billed_cnpjs group by kind order by kind`,
  ),
  billed_all: await q(
    `select
       count(*) filter (where kind = 'enrich')::int as qualify_cnpjs,
       count(*) filter (where kind = 'export')::int as export_cnpjs,
       count(distinct profile_id)::int as accounts
     from billed_cnpjs`,
  ),
  subs: await q(
    `select s.plan, s.status, count(*)::int as n
     from billing_subscriptions s
     group by s.plan, s.status
     order by n desc`,
  ),
  paid_orders: await q(
    `select sku, kind, status, count(*)::int as n,
            coalesce(sum(amount_cents),0)::int as cents
     from billing_orders
     group by sku, kind, status
     order by n desc`,
  ),
  tank: await q(
    `with lots as (
       select profile_id, source, remaining
       from credit_lots
       where remaining > 0
         and (expires_at is null or expires_at > now())
     ),
     latest_sub as (
       select distinct on (profile_id)
         profile_id, plan, status, current_period_end, cancel_at_period_end
       from billing_subscriptions
       order by profile_id, created_at desc
     )
     select
       left(p.nome, 24) as nome,
       p.plano as profile_plano,
       s.plan as sub_plan,
       s.status as sub_status,
       s.cancel_at_period_end,
       s.current_period_end,
       coalesce(sum(l.remaining),0)::int as remaining,
       coalesce(sum(l.remaining) filter (where l.source in ('plan_grant','platform')),0)::int as remaining_plan,
       coalesce(sum(l.remaining) filter (where l.source in ('pack','manual')),0)::int as remaining_pack
     from profiles p
     left join lots l on l.profile_id = p.id
     left join latest_sub s on s.profile_id = p.id
     group by p.id, p.nome, p.plano, s.plan, s.status, s.cancel_at_period_end, s.current_period_end
     having coalesce(sum(l.remaining),0) > 0
         or s.status in ('active','trialing','past_due')
         or p.plano in ('piloto','piloto_pro','escuderia','membro_plataforma')
     order by remaining_plan asc, remaining asc`,
  ),
  billed_by_account: await q(
    `select
       left(p.nome, 24) as nome,
       p.plano as profile_plano,
       count(*) filter (where b.kind = 'enrich')::int as qualify_cnpjs,
       count(*) filter (where b.kind = 'export')::int as export_cnpjs
     from billed_cnpjs b
     left join profiles p on p.id = b.profile_id
     group by p.nome, p.plano
     order by 3 desc, 4 desc`,
  ),
  ledger_by_paid: await q(
    `with active as (
       select distinct on (profile_id) profile_id, plan, status
       from billing_subscriptions
       where status in ('active','trialing')
         and plan in ('piloto','piloto_pro','escuderia')
       order by profile_id, created_at desc
     )
     select
       left(p.nome, 24) as nome,
       a.plan,
       coalesce(sum(l.amount) filter (where l.reason = 'enrich'),0)::int as credits_qualify,
       coalesce(sum(l.amount) filter (where l.reason = 'export'),0)::int as credits_export,
       count(*) filter (where l.reason = 'enrich')::int as debit_rows_qualify,
       count(*) filter (where l.reason = 'export')::int as debit_rows_export
     from active a
     join profiles p on p.id = a.profile_id
     left join credit_ledger l on l.profile_id = a.profile_id and l.type = 'debit'
     group by p.nome, a.plan
     order by 3 desc, 4 desc`,
  ),
  ledger_by_member: await q(
    `with active as (
       select distinct on (profile_id) profile_id, plan, status
       from billing_subscriptions
       where status in ('active','trialing')
         and plan = 'membro_plataforma'
       order by profile_id, created_at desc
     )
     select
       left(p.nome, 24) as nome,
       a.status,
       coalesce(sum(l.amount) filter (where l.reason = 'enrich'),0)::int as credits_qualify,
       coalesce(sum(l.amount) filter (where l.reason = 'export'),0)::int as credits_export
     from active a
     join profiles p on p.id = a.profile_id
     left join credit_ledger l on l.profile_id = a.profile_id and l.type = 'debit'
     group by p.nome, a.status
     order by 3 desc, 4 desc`,
  ),
  billed_export_vs_ledger: await q(
    `select
       (select count(*)::int from billed_cnpjs where kind = 'export') as billed_export_cnpjs,
       (select coalesce(sum(amount),0)::int from credit_ledger where type='debit' and reason='export') as ledger_export_credits,
       (select count(*)::int from billed_cnpjs where kind = 'enrich') as billed_enrich_cnpjs,
       (select coalesce(sum(amount),0)::int from credit_ledger where type='debit' and reason='enrich') as ledger_enrich_credits`,
  ),
  import_runs_detail: await q(
    `select pipeline_nome, file_name, created_count, skipped_count, error_count,
            matched_cnpjs, qualified, jsonb_array_length(issues) as issues_n, created_at
     from crm_import_runs
     order by created_at desc`,
  ),
  inbound_event_rows: await q(
    `select status, http_status, message, created_at
     from crm_inbound_events
     order by created_at desc
     limit 20`,
  ),
  profile_counts: await q(
    `select plano, count(*)::int as n from profiles group by plano order by n desc`,
  ),
  indexes_credit_lots: await q(
    `select indexname from pg_indexes
     where tablename = 'credit_lots' order by indexname`,
  ),
  profiles_meta_cols: await q(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='profiles'
       and column_name in ('active_meta_id','funnel_plan')
     order by column_name`,
  ),
  billed_by_paid: await q(
    `with active as (
       select distinct on (profile_id) profile_id, plan
       from billing_subscriptions
       where status in ('active','trialing')
         and plan in ('piloto','piloto_pro','escuderia')
       order by profile_id, created_at desc
     )
     select
       count(*) filter (where b.kind = 'enrich')::int as qualify_cnpjs,
       count(*) filter (where b.kind = 'export')::int as export_cnpjs,
       count(distinct a.profile_id)::int as paid_accounts,
       count(distinct b.profile_id)::int as paid_with_usage
     from active a
     left join billed_cnpjs b on b.profile_id = a.profile_id`,
  ),
  import_runs: await q(
    `select
       count(*)::int as runs,
       coalesce(sum(created_count),0)::int as created,
       coalesce(sum(skipped_count),0)::int as skipped,
       coalesce(sum(error_count),0)::int as errors,
       coalesce(sum(matched_cnpjs),0)::int as matched_cnpjs,
       coalesce(sum(qualified),0)::int as qualified,
       count(*) filter (where error_count = 0)::int as runs_error_zero,
       count(*) filter (where error_count > 0)::int as runs_with_errors,
       count(*) filter (where created_count > 0 and error_count > 0)::int as created_with_row_errors
     from crm_import_runs`,
  ),
  import_issue_messages: await q(
    `select issue->>'status' as status, issue->>'message' as message, count(*)::int as n
     from crm_import_runs r
     cross join lateral jsonb_array_elements(r.issues) issue
     group by 1, 2
     order by n desc
     limit 50`,
  ),
  import_runs_n: await q(`select count(*)::int as n from crm_import_runs`),
  deals_by_source: await q(
    `select coalesce(meta->>'source','(none)') as source,
            count(*)::int as n,
            count(*) filter (where created_at >= now() - interval '30 days')::int as last_30d
     from crm_deals
     group by 1
     order by n desc`,
  ),
  import_deals_cnpj: await q(
    `select
       count(*)::int as import_deals,
       count(*) filter (where cnpj is not null and length(trim(cnpj)) > 0)::int as with_cnpj,
       count(*) filter (where cnpj is null or length(trim(cnpj)) = 0)::int as without_cnpj
     from crm_deals
     where meta->>'source' = 'import'`,
  ),
  inbound_endpoints: await q(
    `select count(*)::int as n from crm_inbound_endpoints`,
  ),
  inbound_endpoints_detail: await q(
    `select
       left(p.nome, 24) as nome,
       e.nome as campaign,
       e.lead_kind,
       e.channel,
       e.created_at
     from crm_inbound_endpoints e
     left join profiles p on p.id = e.user_id
     order by e.created_at desc`,
  ),
  inbound_events_summary: await q(
    `select status, count(*)::int as n,
            count(*) filter (where created_at >= now() - interval '30 days')::int as last_30d
     from crm_inbound_events
     group by status`,
  ),
  inbound_stale: await q(
    `select
       left(p.nome, 24) as nome,
       e.nome as campaign,
       e.created_at as endpoint_created,
       max(ev.created_at) as last_event_at,
       count(ev.id)::int as events_n,
       count(ev.id) filter (where ev.created_at >= now() - interval '30 days')::int as events_30d
     from crm_inbound_endpoints e
     left join crm_inbound_events ev on ev.endpoint_id = e.id
     left join profiles p on p.id = e.user_id
     group by p.nome, e.nome, e.created_at
     order by last_event_at nulls first, e.created_at`,
  ),
};

  console.log(JSON.stringify(out, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
