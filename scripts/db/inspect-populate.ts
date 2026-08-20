#!/usr/bin/env tsx
import { getDatabaseUrl } from "../ingest/config";

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL missing");
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("set statement_timeout = 5000");
    const host = new URL(url).hostname;
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host === "::1";

    const activity = await client.query<{
      pid: number;
      state: string;
      wait_event_type: string | null;
      wait_event: string | null;
      duration: string;
      query: string;
    }>(
      `select pid, state, wait_event_type, wait_event,
              now() - query_start as duration,
              left(query, 200) as query
       from pg_stat_activity
       where datname = current_database()
         and pid <> pg_backend_pid()
         and state = 'active'
         and query not ilike '%pg_stat_activity%'
       order by query_start`,
    );

    const tables = await client.query<{
      relname: string;
      n_live_tup: string;
      n_tup_ins: string;
    }>(
      `select relname, n_live_tup::text, n_tup_ins::text
       from pg_stat_all_tables
       where relname in ('establishments', 'establishments_search')
       order by relname`,
    );

    console.log(
      JSON.stringify(
        {
          at: new Date().toISOString(),
          db_host: host,
          db_local: isLocal,
          active_queries: activity.rows,
          table_stats: tables.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
