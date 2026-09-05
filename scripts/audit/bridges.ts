/**
 * Read-only: CRM qualify/catchup bridge usage in production.
 *   pnpm exec tsx scripts/audit/bridges.ts
 */
import { Client } from "pg";
import { getDatabaseUrl } from "../ingest/config";

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const host = new URL(url).hostname;
  const local =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });

  async function q(sql: string) {
    try {
      return (await client.query(sql)).rows;
    } catch (err) {
      const e = err as { message?: string; code?: string };
      return { _error: e.message ?? String(err), _code: e.code };
    }
  }

  await client.connect();
  const out = {
    queried_at: new Date().toISOString(),
    by_source: await q(`
      select coalesce(meta->>'source','(none)') as source,
             count(*)::int as n,
             count(*) filter (where created_at >= now() - interval '7 days')::int as last_7d,
             count(*) filter (where created_at >= now() - interval '1 day')::int as last_1d,
             min(created_at) as first_at,
             max(created_at) as last_at
      from crm_deals
      group by 1
      order by n desc
    `),
    bridge_by_plan: await q(`
      select coalesce(p.plano,'?') as plano,
             d.meta->>'source' as source,
             count(*)::int as n,
             count(*) filter (where d.created_at >= now() - interval '7 days')::int as last_7d
      from crm_deals d
      join crm_pipelines pipe on pipe.id = d.pipeline_id
      join profiles p on p.id = pipe.user_id
      where d.meta->>'source' in ('qualify_bridge','catchup_bridge')
      group by 1, 2
      order by 1, 2
    `),
    bridge_paid: await q(`
      with paid as (
        select distinct on (profile_id) profile_id, plan
        from billing_subscriptions
        where status in ('active','trialing')
          and plan in ('piloto','piloto_pro','escuderia')
        order by profile_id, created_at desc
      )
      select left(pr.nome, 28) as nome,
             d.meta->>'source' as source,
             count(*)::int as n,
             max(d.created_at) as last_at
      from paid a
      join profiles pr on pr.id = a.profile_id
      join crm_pipelines pipe on pipe.user_id = a.profile_id
      join crm_deals d on d.pipeline_id = pipe.id
      where d.meta->>'source' in ('qualify_bridge','catchup_bridge')
      group by 1, 2
      order by 1, 2
    `),
    catchup_state: await q(`
      select left(p.nome, 28) as nome,
             p.plano,
             s.task_id,
             s.status,
             s.has_more,
             s.last_ran_at,
             s.last_result
      from user_catchup_state s
      join profiles p on p.id = s.user_id
      order by s.last_ran_at desc nulls last
    `),
    backlog: await q(`
      select count(*)::int as qualified_saved_without_deal
      from saved_leads sl
      join searches s on s.id = sl.search_id
      where s.saved = true
        and (
          exists (
            select 1 from billed_cnpjs b
             where b.profile_id = s.user_id
               and rtrim(b.cnpj) = rtrim(sl.cnpj)
               and b.kind = 'enrich'
          )
          or exists (
            select 1 from enrichment_jobs j
             where j.search_id = sl.search_id
               and rtrim(j.cnpj) = rtrim(sl.cnpj)
               and j.status in ('pending','running','done','skipped')
          )
        )
        and not exists (
          select 1 from crm_deals d
          join crm_pipelines p on p.id = d.pipeline_id
           where p.user_id = s.user_id
             and d.cnpj is not null
             and rtrim(d.cnpj) = rtrim(sl.cnpj)
        )
    `),
    backlog_by_user: await q(`
      select left(pr.nome, 28) as nome,
             pr.plano,
             count(*)::int as n
      from saved_leads sl
      join searches s on s.id = sl.search_id
      join profiles pr on pr.id = s.user_id
      where s.saved = true
        and (
          exists (
            select 1 from billed_cnpjs b
             where b.profile_id = s.user_id
               and rtrim(b.cnpj) = rtrim(sl.cnpj)
               and b.kind = 'enrich'
          )
          or exists (
            select 1 from enrichment_jobs j
             where j.search_id = sl.search_id
               and rtrim(j.cnpj) = rtrim(sl.cnpj)
               and j.status in ('pending','running','done','skipped')
          )
        )
        and not exists (
          select 1 from crm_deals d
          join crm_pipelines p on p.id = d.pipeline_id
           where p.user_id = s.user_id
             and d.cnpj is not null
             and rtrim(d.cnpj) = rtrim(sl.cnpj)
        )
      group by 1, 2
      order by 3 desc
      limit 15
    `),
    bridge_without_cnpj: await q(`
      select meta->>'source' as source, count(*)::int as n
      from crm_deals
      where meta->>'source' in ('qualify_bridge','catchup_bridge')
        and (cnpj is null or length(trim(cnpj)) = 0)
      group by 1
    `),
  };
  console.log(JSON.stringify(out, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
