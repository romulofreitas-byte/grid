#!/usr/bin/env tsx
/**
 * Checklist for leaving mock behind: env + RF tables + presets.
 * Does not download RF zips — points at the next ops step when empty.
 */
import "../../src/lib/load-env";
import { collectLaunchEnvIssues } from "../../src/lib/env/deploy";
import { getDataSource, hasLiveDatabase } from "../../src/lib/data";

async function rfSnapshot(): Promise<Record<string, unknown>> {
  if (!hasLiveDatabase()) {
    return { available: false, reason: "DATABASE_URL ausente" };
  }
  try {
    const pg = await import("pg");
    const client = new pg.default.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    const est = await client.query<{ n: string }>(
      "select count(*)::text as n from establishments",
    );
    const presets = await client.query<{ n: string }>(
      "select count(*)::text as n from niche_presets",
    );
    let phoneMv: string | null = null;
    try {
      const pu = await client.query<{ n: string }>(
        "select count(*)::text as n from phone_usage",
      );
      phoneMv = pu.rows[0]?.n ?? "0";
    } catch {
      phoneMv = null;
    }
    await client.end();
    const establishments = Number(est.rows[0]?.n ?? 0);
    const nichePresets = Number(presets.rows[0]?.n ?? 0);
    return {
      available: true,
      establishments,
      nichePresets,
      phoneUsage: phoneMv,
      next:
        establishments === 0
          ? "pnpm ingest --ufs=MG,SP (ou restore dump)"
          : nichePresets === 0
            ? "pnpm seed:presets"
            : "pnpm validate:phones && pnpm worker:dev",
    };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const issues = collectLaunchEnvIssues();
  const rf = await rfSnapshot();
  console.log(
    JSON.stringify(
      {
        event: "live_readiness",
        dataSource: getDataSource(),
        envIssues: issues,
        rf,
      },
      null,
      2,
    ),
  );
  const blocking =
    issues.some((i) => i.level === "error") ||
    (typeof rf.establishments === "number" && rf.establishments === 0);
  process.exit(blocking ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
