#!/usr/bin/env tsx
import { getDatabaseUrl } from "../ingest/config";

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL missing");
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("set statement_timeout = 15000");
    const stuck = await client.query<{ pid: number; state: string; query: string }>(
      `select pid, state, left(query, 80) as query
       from pg_stat_activity
       where datname = current_database()
         and pid <> pg_backend_pid()
         and query ilike '%establishments_search%'`,
    );
    console.log("stuck:", JSON.stringify(stuck.rows, null, 2));
    for (const row of stuck.rows) {
      const res = await client.query<{ pg_terminate_backend: boolean }>(
        "select pg_terminate_backend($1)",
        [row.pid],
      );
      console.log(`terminate ${row.pid}:`, res.rows[0]);
    }
    await new Promise((r) => setTimeout(r, 2000));
    const remaining = await client.query<{ pid: number }>(
      `select pid from pg_stat_activity
       where datname = current_database()
         and pid <> pg_backend_pid()
         and query ilike '%establishments_search%'`,
    );
    console.log("remaining:", remaining.rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
