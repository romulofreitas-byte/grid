#!/usr/bin/env tsx
import { getDatabaseUrl } from "../ingest/config";

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL missing");
  let host = "unparsed";
  try {
    host = new URL(url).hostname;
  } catch {
    /* keep unparsed */
  }
  console.log("host", host);
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("set statement_timeout = 15000");
    const before = await client.query<{ status: string; n: number }>(
      `select status, count(*)::int as n
         from enrichment_jobs
        where status in ('pending', 'running')
        group by status
        order by status`,
    );
    console.log("before", before.rows);
    const upd = await client.query(
      `update enrichment_jobs
          set status = 'skipped',
              last_error = 'serper_paused',
              finished_at = now(),
              locked_at = null
        where status in ('pending', 'running')`,
    );
    console.log("skipped", upd.rowCount);
    const after = await client.query<{ status: string; n: number }>(
      `select status, count(*)::int as n
         from enrichment_jobs
        where status in ('pending', 'running')
        group by status`,
    );
    console.log("after", after.rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
