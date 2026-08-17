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
           'integration_events','integration_external_ids','platform_subscribers'
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
