#!/usr/bin/env tsx
/**
 * Apply additive app schema (integrations + billing + cockpit) to an existing Postgres/Supabase.
 * Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS.
 *
 *   pnpm db:apply-app
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDatabaseUrl, REPO_ROOT } from "../ingest/config";

const FILES = [
  "supabase/migrations/20260816000000_integrations.sql",
  "supabase/migrations/20260817000000_billing.sql",
  "supabase/migrations/20260818000000_cockpit.sql",
  "supabase/migrations/20260820000000_lead_enrichment_people.sql",
  "supabase/migrations/20260821000000_lead_enrichment_stage.sql",
  "supabase/migrations/20260822000000_platform_subscribers.sql",
  "supabase/migrations/20260823000000_abuse_limits.sql",
  "supabase/migrations/20260824000000_establishments_search.sql",
  "supabase/migrations/20260825000000_es_active_phone_index.sql",
  "supabase/migrations/20260826000000_presence_gmb.sql",
  "supabase/migrations/20260827000000_crm.sql",
  "supabase/migrations/20260828000000_crm_phones.sql",
  "supabase/migrations/20260829000000_crm_deal_cnpj.sql",
  "supabase/migrations/20260830000000_voip_providers.sql",
  "supabase/migrations/20260831000000_crm_stage_keys.sql",
  "supabase/migrations/20260901000000_search_jobs.sql",
  "supabase/migrations/20260902000000_user_catchup_state.sql",
  "supabase/migrations/20260903000000_lock_postgrest.sql",
  "supabase/migrations/20260904000000_crm_events.sql",
  "supabase/migrations/20260905000000_crm_people_nota.sql",
  "supabase/migrations/20260906000000_crm_email.sql",
  "supabase/migrations/20260907000000_enrichment_job_priority.sql",
  "supabase/migrations/20260908000000_crm_deal_amount.sql",
  "supabase/migrations/20260909000000_funnel_plan.sql",
  "supabase/migrations/20260910000000_call_event_source_crm.sql",
  "supabase/migrations/20260911000000_credit_lot_idempotency.sql",
  "supabase/migrations/20260912000000_crm_inbound_endpoints.sql",
  "supabase/migrations/20260914000000_crm_deal_search.sql",
] as const;

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not set (check .env.local).");
  }

  const { Client } = await import("pg");
  const local = (() => {
    try {
      const host = new URL(url).hostname;
      return host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
      return false;
    }
  })();
  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const enrich = await client.query<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
       where table_schema = 'public' and table_name = 'lead_enrichment'`,
    );
    const hasEnrichment = Number(enrich.rows[0]?.n ?? 0) > 0;

    for (const rel of FILES) {
      if (rel.includes("lead_enrichment") && !hasEnrichment) {
        console.log(`Skip ${rel} (lead_enrichment missing)`);
        continue;
      }
      const full = path.join(REPO_ROOT, rel);
      if (!existsSync(full)) throw new Error(`Missing ${rel}`);
      console.log(`Applying ${rel}...`);
      await client.query(readFileSync(full, "utf8"));
    }

    const tables = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name in (
           'credit_lots','credit_ledger','billing_orders','billing_subscriptions',
           'billing_customers','payment_events','billed_cnpjs','treasury_transfers',
           'call_events','integration_connections','integration_jobs',
           'integration_events','integration_external_ids','platform_subscribers',
           'crm_pipelines','crm_stages','crm_deals','crm_activities','crm_events',
           'crm_inbound_endpoints','search_jobs','user_catchup_state'
         )
       order by table_name`,
    );
    console.log(
      "Ready:",
      tables.rows.map((r) => r.table_name).join(", ") || "(none)",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
