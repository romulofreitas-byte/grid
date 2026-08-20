#!/usr/bin/env tsx
import { getDatabaseUrl } from "../ingest/config";

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL missing");
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const est = await client.query<{ n: number }>(
      "select count(*)::int as n from establishments",
    );
    let searchN = 0;
    let searchError: string | null = null;
    try {
      const search = await client.query<{ n: number }>(
        "select count(*)::int as n from establishments_search",
      );
      searchN = Number(search.rows[0]?.n ?? 0);
    } catch (err) {
      searchError =
        err instanceof Error ? err.message : "establishments_search unavailable";
      searchN = -1;
    }
    console.log(
      JSON.stringify({
        establishments: Number(est.rows[0]?.n ?? 0),
        establishments_search: searchN,
        search_error: searchError,
      }),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
