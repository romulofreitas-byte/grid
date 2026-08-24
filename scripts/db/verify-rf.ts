#!/usr/bin/env tsx
/**
 * Verify RF tables / MVs exist and have rows on DATABASE_URL.
 * Exit 0 when healthy; 1 when missing env, empty RF, or query failure.
 *
 * Usage: pnpm db:verify-rf
 */
import "../../src/lib/load-env";
import { getDataSource, hasLiveDatabase } from "../../src/lib/data";

async function main() {
  if (!hasLiveDatabase()) {
    console.error(
      JSON.stringify({
        event: "verify_rf_failed",
        reason: "DATABASE_URL ausente",
      }),
    );
    process.exit(1);
  }
  if (getDataSource() === "mock") {
    console.warn(
      JSON.stringify({
        event: "verify_rf_warn",
        message:
          "DATA_SOURCE=mock — o app não usará este Postgres até DATA_SOURCE=postgres.",
      }),
    );
  }

  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const checks: Array<{ name: string; sql: string; min: number }> = [
    { name: "establishments", sql: "select count(*)::int as n from establishments", min: 1 },
    { name: "companies", sql: "select count(*)::int as n from companies", min: 1 },
    { name: "partners", sql: "select count(*)::int as n from partners", min: 0 },
    {
      name: "phone_usage",
      sql: "select count(*)::int as n from phone_usage",
      min: 0,
    },
    {
      name: "niche_presets",
      sql: "select count(*)::int as n from niche_presets",
      min: 1,
    },
  ];

  const results: Record<string, number | string> = {};
  let failed = false;

  for (const check of checks) {
    try {
      const r = await client.query<{ n: number }>(check.sql);
      const n = Number(r.rows[0]?.n ?? 0);
      results[check.name] = n;
      if (n < check.min) {
        failed = true;
        results[`${check.name}_status`] = "empty";
      } else {
        results[`${check.name}_status`] = "ok";
      }
    } catch (err) {
      failed = true;
      results[check.name] = 0;
      results[`${check.name}_status`] =
        err instanceof Error ? err.message : String(err);
    }
  }

  await client.end();

  console.log(
    JSON.stringify({
      event: failed ? "verify_rf_failed" : "verify_rf_ok",
      dataSource: process.env.DATA_SOURCE ?? "mock",
      ...results,
    }),
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
