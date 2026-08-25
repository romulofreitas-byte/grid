#!/usr/bin/env tsx
/**
 * Fail if the working tree / git index is about to leak infra (env files,
 * live Supabase project ref, coupon in .env.example).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../ingest/config";

/** Historical project ref — keep encoded so this file is not a leak itself. */
const FORBIDDEN_PROJECT_REF = Buffer.from(
  "c21yb3JhaXp6cmJicmt3cGF1a2g=",
  "base64",
).toString("utf8");

const ENV_NAME = /^\.env(\..+)?$/;
const ENV_EXAMPLE = ".env.example";

function gitLines(args: string[]): string[] {
  try {
    const out = execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isForbiddenEnvPath(rel: string): boolean {
  const base = path.posix.basename(rel.replace(/\\/g, "/"));
  if (base === ENV_EXAMPLE) return false;
  return ENV_NAME.test(base);
}

export function collectSecretIssues(): string[] {
  const issues: string[] = [];
  const tracked = gitLines(["ls-files"]);
  const staged = gitLines(["diff", "--cached", "--name-only"]);
  const unstaged = gitLines(["diff", "--name-only"]);
  const paths = new Set([...tracked, ...staged, ...unstaged]);

  for (const rel of paths) {
    if (isForbiddenEnvPath(rel)) {
      issues.push(`arquivo de env no git: ${rel}`);
    }
  }

  const examplePath = path.join(REPO_ROOT, ENV_EXAMPLE);
  try {
    const example = readFileSync(examplePath, "utf8");
    if (/^BILLING_PLATFORM_COUPON=.+\S/m.test(example)) {
      issues.push(
        ".env.example não pode ter BILLING_PLATFORM_COUPON preenchido",
      );
    }
  } catch {
    /* missing example is not this check's job */
  }

  for (const rel of tracked) {
    if (rel.replace(/\\/g, "/").endsWith("scripts/launch/check-secrets.ts")) {
      continue;
    }
    let body = "";
    try {
      body = readFileSync(path.join(REPO_ROOT, rel), "utf8");
    } catch {
      continue;
    }
    if (body.includes(FORBIDDEN_PROJECT_REF)) {
      issues.push(`ref de projeto Supabase em arquivo versionado: ${rel}`);
    }
  }

  return issues;
}

function main(): void {
  const issues = collectSecretIssues();
  if (!issues.length) {
    console.log("OK — nenhum vazamento de infra no git.");
    process.exit(0);
  }
  for (const issue of issues) {
    console.log(`[ERROR] ${issue}`);
  }
  process.exit(1);
}

const invoked = process.argv[1]
  ?.replace(/\\/g, "/")
  .includes("scripts/launch/check-secrets");
if (invoked) {
  main();
}
