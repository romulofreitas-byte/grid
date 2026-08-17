/**
 * Receita Federal CNPJ open-data ingest configuration.
 * RF changed download paths in Jan/2026 — keep URLs env-driven, never inline.
 */

import path from "node:path";
import { loadLocalEnv, repoRoot } from "../../src/lib/load-env";

loadLocalEnv();

const REPO_ROOT = repoRoot();

export { REPO_ROOT };

export const RF_BASE_URL =
  process.env.RF_CNPJ_BASE_URL ??
  "https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/2026-01/";

export const BATCH_SIZE = 5000;

export const FILTER_DEFAULTS = {
  /** Situação cadastral "02" = ativa */
  situacao: "02",
  requireTelefone1: true,
  excludeMei: true,
} as const;

/** All 27 Brazilian UFs (used by --ufs=ALL). */
export const ALL_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type IngestCliArgs = {
  ufs: string[];
  dryRun: boolean;
  help: boolean;
};

const DEFAULT_UFS = ["MG", "SP"];

export function parseArgs(argv: string[] = process.argv.slice(2)): IngestCliArgs {
  let ufs = [...DEFAULT_UFS];
  let dryRun = false;
  let help = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("--ufs=")) {
      const raw = arg.slice("--ufs=".length).trim();
      // pnpm turns --ufs=MG,SP into --ufs=MG SP — split on comma and whitespace
      const tokens = raw
        .split(/[,\s]+/)
        .map((uf) => uf.trim().toUpperCase())
        .filter(Boolean);
      if (tokens.some((t) => t === "ALL" || t === "*")) {
        ufs = [...ALL_UFS];
      } else {
        const unknown = tokens.filter((t) => !ALL_UFS.includes(t as (typeof ALL_UFS)[number]));
        if (unknown.length) {
          throw new Error(`Unknown UF(s): ${unknown.join(", ")}. Use --ufs=MG,SP or --ufs=ALL.`);
        }
        ufs = tokens;
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!ufs.length) {
    throw new Error("At least one UF is required (--ufs=MG,SP or --ufs=ALL).");
  }

  return { ufs, dryRun, help };
}

export function getDatabaseUrl(): string | undefined {
  const value = process.env.DATABASE_URL?.trim();
  return value || undefined;
}

/** Local folder for downloaded/extracted RF files (dry-run reads from here). */
export const DATA_DIR = path.join(REPO_ROOT, "scripts/ingest/data");

/** One-inner-zip-at-a-time scratch dir (deleted after each archive). */
export const EXTRACT_DIR = path.join(DATA_DIR, ".extracted");

export const SCHEMA_RF_PATH = path.join(REPO_ROOT, "scripts/ingest/schema-rf.sql");
export const SCHEMA_APP_PATH = path.join(REPO_ROOT, "scripts/ingest/schema-app.sql");

/** Month dump dropped at the repo root (e.g. 2026-08.zip). */
export const ROOT_MONTH_ZIP = path.join(REPO_ROOT, "2026-08.zip");
export const ROOT_MONTH_DIR = path.join(REPO_ROOT, "2026-08");
