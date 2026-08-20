#!/usr/bin/env tsx
/**
 * Time the establishments_search fast path (count + ranked candidates).
 *   pnpm launch:smoke
 */
import { getDatabaseUrl } from "../ingest/config";

function resolveUrl(): string {
  const pooler = getDatabaseUrl();
  const direct = process.env.SUPABASE_DB_URL?.trim();
  if (pooler && (pooler.includes("pooler") || new URL(pooler).port === "6543") && direct) {
    return direct;
  }
  if (!pooler) throw new Error("DATABASE_URL is not set");
  return pooler;
}

async function timed<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  const value = await fn();
  console.log(`${label}: ${Date.now() - t0}ms`);
  return value;
}

async function main(): Promise<void> {
  const url = resolveUrl();
  const { Client } = await import("pg");
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("set statement_timeout = 60000");
  try {
    const n = await timed("rowcount", async () => {
      const { rows } = await client.query<{ n: number }>(
        "select count(*)::int as n from establishments_search",
      );
      return Number(rows[0]?.n ?? 0);
    });
    console.log(`establishments_search rows: ${n.toLocaleString()}`);
    if (n < 1) {
      console.error("FAIL: table empty — run pnpm db:populate-search");
      process.exit(1);
    }

    const probe = await timed("count default (phone not contabilidade, MG+SP)", async () => {
      const { rows } = await client.query<{ n: number }>(
        `select count(*)::int as n from (
           select 1 from establishments_search es
           where es.opted_out = false
             and es.uf = any($1::text[])
             and es.phone_verdict is distinct from 'contabilidade'
           limit 10001
         ) t`,
        [["MG", "SP"]],
      );
      return Number(rows[0]?.n ?? 0);
    });
    console.log(`count probe (capped 10k): ${probe.toLocaleString()}`);

    const ranked = await timed("runSearch proxy top 5k", async () => {
      const { rows } = await client.query<{ cnpj: string }>(
        `select es.cnpj
         from establishments_search es
         where es.opted_out = false
           and es.uf = any($1::text[])
           and es.phone_verdict is distinct from 'contabilidade'
         order by (
           (case when es.tem_decisor then 7 else 0 end) +
           (case when es.telefone1 is not null then 5 else 0 end) +
           (case when es.phone_verdict = 'proprio' then 10
                 when es.phone_verdict = 'contabilidade' then -5
                 else 3 end) +
           (case when es.email_proprio then 5 else 0 end) +
           (case when es.is_matriz then 1 else 0 end)
         ) desc, es.cnpj
         limit 5000`,
        [["MG", "SP"]],
      );
      return rows.length;
    });
    console.log(`candidates: ${ranked}`);
    console.log("OK");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
