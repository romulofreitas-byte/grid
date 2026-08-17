#!/usr/bin/env tsx
/**
 * Dump the local Docker Postgres and restore into Supabase.
 * Uses local pg_dump/pg_restore when installed; otherwise the postgres:16 image.
 *
 *   pnpm db:dump-supabase
 *   pnpm db:dump-supabase -- --restore
 *   pnpm db:dump-supabase -- --restore --skip-dump
 *   pnpm db:dump-supabase -- --fresh --restore
 *
 * Restore needs SUPABASE_DB_URL (direct, port 5432). Docker on Windows cannot
 * reach the IPv6-only db.*.supabase.co host — the script rewrites to the
 * session pooler (IPv4, port 5432). Do not use transaction pooler 6543.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { getDatabaseUrl, REPO_ROOT } from "../ingest/config";

const PROJECT_URL = "https://smroraizzrbbrkwpaukh.supabase.co";
const PROJECT_REF = "smroraizzrbbrkwpaukh";
const DUMP_DIR = path.join(REPO_ROOT, "tmp", "supabase-dump");
const POSTGRES_IMAGE = "postgres:16";
const DEFAULT_POOLER_REGION = "us-west-2";

function which(cmd: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(probe, [cmd], { encoding: "utf8" });
  return r.status === 0;
}

function dockerOk(): boolean {
  const r = spawnSync("docker", ["info"], { encoding: "utf8" });
  return r.status === 0;
}

function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv): void {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    cwd: REPO_ROOT,
    shell: false,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function dumpWithDocker(source: string, dumpFile: string): void {
  const url = new URL(source);
  const host =
    url.hostname === "127.0.0.1" || url.hostname === "localhost"
      ? "host.docker.internal"
      : url.hostname;
  const port = url.port || "5432";
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const db = url.pathname.replace(/^\//, "") || "postgres";
  console.log("Using postgres:16 Docker image for pg_dump (no local client).");
  run(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      `PGPASSWORD=${password}`,
      "-v",
      `${DUMP_DIR}:/dump`,
      POSTGRES_IMAGE,
      "pg_dump",
      "-h",
      host,
      "-p",
      port,
      "-U",
      user,
      "-d",
      db,
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "-f",
      `/dump/${path.basename(dumpFile)}`,
    ],
  );
}

function withSsl(dest: string): string {
  const joiner = dest.includes("?") ? "&" : "?";
  let url = dest.includes("sslmode=") ? dest : `${dest}${joiner}sslmode=require`;
  if (!url.includes("keepalives=")) {
    url += `${url.includes("?") ? "&" : "?"}keepalives=1&keepalives_idle=30&keepalives_interval=10&keepalives_count=5`;
  }
  return url;
}

/** Docker Desktop on Windows has no IPv6 path to db.*.supabase.co (AAAA-only). */
function restoreTargetUrl(direct: string): string {
  const explicit = process.env.SUPABASE_POOLER_URL?.trim();
  if (explicit) return explicit;
  let url: URL;
  try {
    url = new URL(direct);
  } catch {
    return direct;
  }
  if (!/^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname)) return direct;
  const ref = url.hostname.split(".")[1];
  const region =
    process.env.SUPABASE_POOLER_REGION?.trim() || DEFAULT_POOLER_REGION;
  const pass = decodeURIComponent(url.password);
  const db = url.pathname.replace(/^\//, "") || "postgres";
  return `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-${region}.pooler.supabase.com:5432/${db}`;
}

function restoreWithDocker(dest: string, dumpFile: string): void {
  const sslDest = withSsl(dest);
  console.log("Using postgres:16 Docker image for pg_restore.");
  run("docker", [
    "run",
    "--rm",
    "-e",
    "PGOPTIONS=-c statement_timeout=0",
    "-v",
    `${DUMP_DIR}:/dump`,
    POSTGRES_IMAGE,
    "pg_restore",
    "--verbose",
    "--exit-on-error",
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-acl",
    `--dbname=${sslDest}`,
    `/dump/${path.basename(dumpFile)}`,
  ]);
}

function psqlWithDocker(dest: string, sqlFile: string): void {
  const sslDest = withSsl(dest);
  run("docker", [
    "run",
    "--rm",
    "-e",
    "PGOPTIONS=-c statement_timeout=0",
    "-v",
    `${path.dirname(sqlFile)}:/sql`,
    POSTGRES_IMAGE,
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    sslDest,
    "-f",
    `/sql/${path.basename(sqlFile)}`,
  ]);
}

function main() {
  const source = getDatabaseUrl();
  if (!source) {
    console.error("DATABASE_URL is not set (source Docker/local Postgres).");
    process.exit(1);
  }
  const restore = process.argv.includes("--restore");
  const fresh = process.argv.includes("--fresh");
  const skipDump = process.argv.includes("--skip-dump");
  const dest = process.env.SUPABASE_DB_URL?.trim();

  console.log("GRID → Supabase dump/restore\n");
  console.log(`Project: ${PROJECT_URL}`);
  console.log(`Ref:     ${PROJECT_REF}`);
  console.log(`Source:  ${source.replace(/:[^:@/]+@/, ":***@")}`);
  console.log("");
  console.log("Use the Direct connection (port 5432), not the transaction pooler (6543).");
  console.log("Docker restore uses the session pooler (IPv4) when the direct host is IPv6-only.");
  console.log("MG+SP RF data often exceeds the Free 500 MB quota — Pro is likely required.\n");

  const hasLocalDump = which("pg_dump");
  const hasDocker = dockerOk();
  if (!hasLocalDump && !hasDocker) {
    console.error(
      "Neither pg_dump nor Docker is available.\n" +
        "Start Docker Desktop (the GRID Postgres container) and retry.",
    );
    process.exit(1);
  }

  mkdirSync(DUMP_DIR, { recursive: true });
  const dumpFile = path.join(DUMP_DIR, "grid.dump");
  const dumpExists = existsSync(dumpFile);
  const reuseDump = dumpExists && !fresh && (skipDump || restore);

  if (reuseDump) {
    const gb = (statSync(dumpFile).size / 1024 ** 3).toFixed(2);
    console.log(`Reusing existing dump (${gb} GB) at ${dumpFile}`);
    console.log("Pass --fresh to dump again.\n");
  } else {
    console.log(`Dumping to ${dumpFile} …`);
    if (hasLocalDump) {
      run("pg_dump", [
        "--format=custom",
        "--no-owner",
        "--no-acl",
        `--file=${dumpFile}`,
        source,
      ]);
    } else {
      dumpWithDocker(source, dumpFile);
    }
    if (!existsSync(dumpFile)) {
      console.error("Dump file was not created.");
      process.exit(1);
    }
    console.log("Dump done.\n");
  }

  console.log("Restore:\n");
  console.log(`  pnpm db:dump-supabase -- --restore`);
  console.log("");
  console.log("Then: pnpm seed:presets");
  console.log("");
  console.log("App .env.local after cutover:");
  console.log(`  NEXT_PUBLIC_SUPABASE_URL=${PROJECT_URL}`);
  console.log("  DATABASE_URL=<SUPABASE_DB_URL>");
  console.log("  DATA_SOURCE=postgres\n");

  if (!restore) return;

  if (!dest) {
    console.error("--restore needs SUPABASE_DB_URL in .env.local.");
    process.exit(1);
  }
  const restoreUrl = restoreTargetUrl(dest);
  console.log(
    `\nRestoring via ${restoreUrl.replace(/:[^:@/]+@/, ":***@")} …`,
  );
  if (which("pg_restore")) {
    run("pg_restore", [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      `--dbname=${restoreUrl}`,
      dumpFile,
    ]);
  } else if (hasDocker) {
    restoreWithDocker(restoreUrl, dumpFile);
  } else {
    console.error("pg_restore not found and Docker is unavailable.");
    process.exit(1);
  }

  const sql = path.join(REPO_ROOT, "scripts", "db", "post-restore.sql");
  if (existsSync(sql)) {
    console.log("\nApplying post-restore indexes / MV refresh…");
    if (which("psql")) {
      run("psql", [restoreUrl, "-f", sql]);
    } else if (hasDocker) {
      psqlWithDocker(restoreUrl, sql);
    }
  }
  console.log("Restore finished.");
}

main();
