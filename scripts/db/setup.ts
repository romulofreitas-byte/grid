#!/usr/bin/env tsx
/**
 * Apply vanilla-Postgres schemas and seed niche presets + local profile.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDatabaseUrl, REPO_ROOT, SCHEMA_RF_PATH } from "../ingest/config";

const SCHEMA_APP_PATH = path.join(REPO_ROOT, "scripts/ingest/schema-app.sql");
const SCHEMA_BILLING_PATH = path.join(REPO_ROOT, "scripts/ingest/schema-billing.sql");

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not set (check .env.local).");
  }
  if (!existsSync(SCHEMA_RF_PATH) || !existsSync(SCHEMA_APP_PATH) || !existsSync(SCHEMA_BILLING_PATH)) {
    throw new Error("Missing schema SQL files.");
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    console.log("Applying RF schema...");
    await client.query(readFileSync(SCHEMA_RF_PATH, "utf8"));
    console.log("Applying app schema...");
    await client.query(readFileSync(SCHEMA_APP_PATH, "utf8"));
    console.log("Applying billing schema...");
    await client.query(readFileSync(SCHEMA_BILLING_PATH, "utf8"));
  } finally {
    await client.end();
  }

  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["seed:presets"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, DATABASE_URL: url },
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`seed:presets exited ${code}`)),
    );
  });

  const { Client: Client2 } = await import("pg");
  const check = new Client2({ connectionString: url });
  await check.connect();
  try {
    const est = await check.query("select count(*)::int as n from establishments");
    const presets = await check.query("select count(*)::int as n from niche_presets");
    const cnaes = await check.query("select count(*)::int as n from ref_cnae");
    console.log("\n=== GRID Postgres ===");
    console.log(`niche_presets:   ${presets.rows[0].n}`);
    console.log(`ref_cnae:        ${cnaes.rows[0].n}`);
    console.log(`establishments:  ${est.rows[0].n}`);
    if (Number(est.rows[0].n) === 0) {
      console.log("\nNo CNPJ rows yet. Run: pnpm ingest:download && pnpm ingest --ufs=MG,SP");
    }
  } finally {
    await check.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
