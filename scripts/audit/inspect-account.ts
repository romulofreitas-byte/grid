/**
 * Read-only account integrity dump. Prints JSON. No writes.
 *   pnpm exec tsx scripts/audit/inspect-account.ts contato@goalsperformance.com.br
 */
import { Client } from "pg";
import { getDatabaseUrl } from "../ingest/config";

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("usage: pnpm exec tsx scripts/audit/inspect-account.ts email@dominio");
    process.exit(1);
  }
  const url = getDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(2);
  }

  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();

  const domain = email.split("@")[1] ?? email;
  const profiles = await client.query(
    `select p.id, au.email, p.nome, p.empresa_usuario, p.plano, p.creditos, p.created_at
       from profiles p
       left join auth.users au on au.id = p.id
      where lower(coalesce(au.email, '')) = $1
         or lower(coalesce(au.email, '')) like '%' || $2 || '%'
         or lower(coalesce(p.empresa_usuario, '')) like '%' || $2 || '%'
         or lower(coalesce(p.nome, '')) like '%' || $2 || '%'
      order by p.created_at`,
    [email, domain],
  );

  const out: Record<string, unknown> = {
    queried_at: new Date().toISOString(),
    email,
    profiles: profiles.rows,
  };

  for (const p of profiles.rows as Array<{ id: string }>) {
    const id = p.id;
    const [subs, orders, lots, billed, jobs, searches, deals] = await Promise.all([
      client.query(
        `select id, plan, status, provider, provider_sub_id,
                current_period_start, current_period_end, cancel_at_period_end
           from billing_subscriptions where profile_id=$1
           order by current_period_end desc`,
        [id],
      ),
      client.query(
        `select id, sku, kind, status, provider, amount_cents, created_at, paid_at
           from billing_orders where profile_id=$1 order by created_at desc`,
        [id],
      ),
      client.query(
        `select id, qty, remaining, source, expires_at, created_at
           from credit_lots where profile_id=$1 order by created_at desc limit 20`,
        [id],
      ),
      client.query(
        `select count(*)::int as n, min(created_at) as first_at, max(created_at) as last_at
           from billed_cnpjs where profile_id=$1 and kind='enrich'`,
        [id],
      ),
      client.query(
        `select status, count(*)::int as n
           from enrichment_jobs
          where search_id in (select id from searches where user_id=$1)
          group by status`,
        [id],
      ),
      client.query(`select count(*)::int as n from searches where user_id=$1`, [id]),
      client.query(
        `select count(*)::int as n
           from crm_deals d
           join crm_pipelines p on p.id = d.pipeline_id
          where p.user_id=$1`,
        [id],
      ),
    ]);
    out[id] = {
      subscriptions: subs.rows,
      orders: orders.rows,
      lots: lots.rows,
      billed: billed.rows,
      jobs: jobs.rows,
      searches: searches.rows,
      deals: deals.rows,
    };
  }

  console.log(JSON.stringify(out, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
