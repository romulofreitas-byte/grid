#!/usr/bin/env tsx
/**
 * GRID — Receita Federal CNPJ ingest pipeline (Phase 0).
 *
 * Usage:
 *   pnpm ingest [--ufs=MG,SP] [--dry-run]
 *   pnpm ingest --ufs=ALL
 *
 * Requires DATABASE_URL for full load; without it, runs in mock/plan mode.
 * Discovers 2026-08.zip at the repo root (nested RF zips) or files under
 * scripts/ingest/data/.
 */

import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { once } from "node:events";
import path from "node:path";
import readline from "node:readline";
import {
  ALL_UFS,
  DATA_DIR,
  FILTER_DEFAULTS,
  REPO_ROOT,
  RF_BASE_URL,
  SCHEMA_APP_PATH,
  SCHEMA_RF_PATH,
  getDatabaseUrl,
  parseArgs,
} from "./config";
import { copyWhileStreaming, toTsvLine } from "./copy";
import { CnpjBitset } from "./bitset";
import { ESTABELECIMENTOS, SIMPLES } from "./layout";
import {
  normalizePhone,
  normalizeUf,
  parseCsvLine,
  pickField,
} from "./parse";
import {
  CNAE_COLUMNS,
  COMPANY_COLUMNS,
  ESTABLISHMENT_COLUMNS,
  MUNICIPIO_COLUMNS,
  NATUREZA_COLUMNS,
  PARTNER_COLUMNS,
  QUALIFICACAO_COLUMNS,
  SIMPLES_COLUMNS,
  mapCnae,
  mapCompany,
  mapEstablishment,
  mapMunicipio,
  mapNatureza,
  mapPartner,
  mapQualificacao,
  mapSimples,
} from "./rows";
import { describeSources, discoverSources, streamKindLines } from "./sources";

type DryRunStats = {
  files: string[];
  totalLines: number;
  filteredLines: number;
  skippedSituacao: number;
  skippedTelefone: number;
  skippedUf: number;
  skippedMei: number;
  skippedInvalid: number;
};

const LOAD_INDEXES = [
  "drop index if exists idx_est_search",
  "drop index if exists idx_est_cnae",
  "drop index if exists idx_est_basico",
  "drop index if exists idx_part_basico",
  "drop index if exists idx_comp_razao",
  "drop index if exists idx_est_fantasia",
  "drop index if exists idx_cnae_desc",
] as const;

const CREATE_INDEXES = [
  "create index if not exists idx_est_search on establishments (uf, municipio_id, cnae_principal)",
  "create index if not exists idx_est_cnae on establishments (cnae_principal)",
  "create index if not exists idx_est_basico on establishments (cnpj_basico)",
  "create index if not exists idx_part_basico on partners (cnpj_basico)",
  "create index if not exists idx_comp_razao on companies using gin (razao_social gin_trgm_ops)",
  "create index if not exists idx_est_fantasia on establishments using gin (nome_fantasia gin_trgm_ops)",
  "create index if not exists idx_cnae_desc on ref_cnae using gin (descricao gin_trgm_ops)",
] as const;

function printHelp(): void {
  console.log(`
GRID Receita Federal ingest pipeline

Usage:
  pnpm ingest [--ufs=MG,SP] [--dry-run]
  pnpm ingest --ufs=ALL

Options:
  --ufs=MG,SP   Restrict establishments to these UFs (default: MG,SP)
  --ufs=ALL     All 27 Brazilian UFs
                PowerShell/pnpm: pnpm ingest -- --ufs=ALL   or   --ufs="MG,SP"
  --dry-run     Count filtered rows from local dumps without writing to Postgres
  --help, -h    Show this help

Environment:
  RF_CNPJ_BASE_URL   Base URL for RF open-data zips (Jan/2026 path change)
  DATABASE_URL       Postgres connection string (required for full ingest)
                     docker compose: postgresql://grid:grid@127.0.0.1:5432/grid

Local data (first match wins):
  1. Zip/CSV files under scripts/ingest/data/
  2. 2026-08.zip at the repo root (nested RF zips)
  3. 2026-08/ folder at the repo root
`);
}

function printPlan(ufs: string[], dryRun: boolean): void {
  const databaseUrl = getDatabaseUrl();
  console.log("\n=== GRID RF Ingest Plan ===\n");
  console.log(`Base URL:     ${RF_BASE_URL}`);
  console.log(`UF filter:    ${ufs.join(", ")}`);
  console.log(
    `Filters:      situacao=${FILTER_DEFAULTS.situacao}, telefone1 required, exclude MEI`,
  );
  console.log(
    `Mode:         ${dryRun ? "dry-run (count only)" : databaseUrl ? "live COPY" : "plan / mock"}`,
  );
  console.log(`Sources:      ${describeSources()}\n`);

  const steps = [
    "1. Discover RF zips (data/ or 2026-08.zip nested archive)",
    "2. Stream inner zips one at a time (no full unzip, no Expand-Archive)",
    "3. Parse CSV rows (ISO-8859-1, semicolon, quoted, EMPRECSV/ESTABELE/…)",
    "4. Apply ingest filters (ativa, telefone1, exclude MEI, UF subset)",
    "5. COPY refs → companies → establishments → partners → simples",
    "6. Create search indexes AFTER bulk load",
    "7. REFRESH MATERIALIZED VIEWs (phone/email/address + phone_shared_verdict + cnae_uf_count)",
    "8. Record run metadata in ingest_runs",
  ];

  for (const step of steps) console.log(step);
  console.log("");
}

function emptyStats(): DryRunStats {
  return {
    files: [],
    totalLines: 0,
    filteredLines: 0,
    skippedSituacao: 0,
    skippedTelefone: 0,
    skippedUf: 0,
    skippedMei: 0,
    skippedInvalid: 0,
  };
}

function passesEstablishmentFilter(
  fields: string[],
  ufs: Set<string>,
  meiSet: CnpjBitset,
  stats: DryRunStats,
): boolean {
  const situacao = pickField(fields, ESTABELECIMENTOS.situacao);
  const uf = normalizeUf(pickField(fields, ESTABELECIMENTOS.uf));
  const telefone1 = normalizePhone(pickField(fields, ESTABELECIMENTOS.telefone1));
  const cnpjBasico = pickField(fields, ESTABELECIMENTOS.cnpj_basico).replace(/\D/g, "");

  if (FILTER_DEFAULTS.requireTelefone1 && !telefone1) {
    stats.skippedTelefone++;
    return false;
  }
  if (situacao !== FILTER_DEFAULTS.situacao) {
    stats.skippedSituacao++;
    return false;
  }
  if (!uf || !ufs.has(uf)) {
    stats.skippedUf++;
    return false;
  }
  if (
    FILTER_DEFAULTS.excludeMei &&
    cnpjBasico &&
    meiSet.has(cnpjBasico.padStart(8, "0").slice(0, 8))
  ) {
    stats.skippedMei++;
    return false;
  }

  return true;
}

async function loadMeiSet(): Promise<CnpjBitset> {
  const mei = new CnpjBitset();
  console.log("Loading MEI flags from Simples files...");
  await streamKindLines("simples", (line) => {
    const fields = parseCsvLine(line);
    const cnpjBasico = pickField(fields, SIMPLES.cnpj_basico).replace(/\D/g, "");
    const opcaoMei = pickField(fields, SIMPLES.opcao_mei).toUpperCase();
    if (cnpjBasico && opcaoMei === "S") mei.add(cnpjBasico);
  });
  console.log(`  ${mei.size.toLocaleString()} CNPJs flagged as MEI\n`);
  return mei;
}

async function dryRunCount(ufs: string[]): Promise<DryRunStats> {
  const ufSet = new Set(ufs);
  const stats = emptyStats();
  const sources = discoverSources();
  if (!sources.length) return stats;

  const meiSet = await loadMeiSet();

  console.log("Scanning estabelecimentos...\n");
  const scanned = await streamKindLines("estabelecimentos", (line, label) => {
    if (!stats.files.includes(label)) stats.files.push(label);
    const fields = parseCsvLine(line);
    stats.totalLines++;
    if (passesEstablishmentFilter(fields, ufSet, meiSet, stats)) {
      stats.filteredLines++;
    }
  });

  if (!stats.files.length) stats.files = scanned.files;
  return stats;
}

function hashSources(): string {
  const sources = discoverSources()
    .map((s) => s.path)
    .sort()
    .join("|");
  return createHash("sha256").update(sources).digest("hex").slice(0, 16);
}

async function applySchema(client: import("pg").Client): Promise<void> {
  if (!existsSync(SCHEMA_RF_PATH)) {
    throw new Error(`Missing schema file: ${SCHEMA_RF_PATH}`);
  }
  await client.query(readFileSync(SCHEMA_RF_PATH, "utf8"));
  if (existsSync(SCHEMA_APP_PATH)) {
    await client.query(readFileSync(SCHEMA_APP_PATH, "utf8"));
  }
  console.log("Schema applied (CREATE IF NOT EXISTS).\n");
}

async function copyRefs(
  client: import("pg").Client,
  copyFrom: typeof import("pg-copy-streams").from,
): Promise<void> {
  console.log("COPY reference tables...");

  const jobs = [
    { kind: "cnaes" as const, table: "ref_cnae", columns: [...CNAE_COLUMNS], map: mapCnae },
    {
      kind: "municipios" as const,
      table: "ref_municipio",
      columns: [...MUNICIPIO_COLUMNS],
      map: mapMunicipio,
    },
    {
      kind: "naturezas" as const,
      table: "ref_natureza",
      columns: [...NATUREZA_COLUMNS],
      map: mapNatureza,
    },
    {
      kind: "qualificacoes" as const,
      table: "ref_qualificacao",
      columns: [...QUALIFICACAO_COLUMNS],
      map: mapQualificacao,
    },
  ];

  for (const job of jobs) {
    const seen = new Set<string>();
    const n = await copyWhileStreaming(client, copyFrom, job.table, job.columns, async (write) => {
      await streamKindLines(job.kind, async (line) => {
        const row = job.map(parseCsvLine(line));
        if (!row) return;
        const key = String(row[0]);
        if (seen.has(key)) return;
        seen.add(key);
        await write(row);
      });
    });
    console.log(`  ${job.table}: ${n.toLocaleString()} rows`);
  }
  console.log("");
}

async function writeEstablishmentTsv(
  ufs: Set<string>,
  meiSet: CnpjBitset,
  stats: DryRunStats,
): Promise<{ filePath: string; cnpjSet: CnpjBitset }> {
  mkdirSync(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, "establishments.filtered.tsv");
  const out = createWriteStream(filePath, { encoding: "utf8" });
  const cnpjSet = new CnpjBitset();

  console.log("Filtering estabelecimentos → temp TSV...\n");
  await streamKindLines("estabelecimentos", async (line, label) => {
    if (!stats.files.includes(label)) stats.files.push(label);
    const fields = parseCsvLine(line);
    stats.totalLines++;
    if (stats.totalLines % 1_000_000 === 0) {
      console.log(
        `    … ${stats.totalLines.toLocaleString()} scanned, ${stats.filteredLines.toLocaleString()} kept`,
      );
    }
    if (!passesEstablishmentFilter(fields, ufs, meiSet, stats)) return;
    const row = mapEstablishment(fields);
    if (!row) {
      stats.skippedInvalid++;
      return;
    }
    const basico = row[1] as string;
    cnpjSet.add(basico);
    stats.filteredLines++;
    const chunk = toTsvLine(row);
    if (!out.write(chunk)) await once(out, "drain");
  });

  out.end();
  await once(out, "finish");
  console.log(
    `\n  Kept ${stats.filteredLines.toLocaleString()} establishments / ${cnpjSet.size.toLocaleString()} companies\n`,
  );
  return { filePath, cnpjSet };
}

async function collectEstablishmentCnpjs(
  ufs: Set<string>,
  meiSet: CnpjBitset,
  stats: DryRunStats,
): Promise<CnpjBitset> {
  const cnpjSet = new CnpjBitset();
  console.log("Pass 1: scanning estabelecimentos for company keys (no TSV)...\n");
  await streamKindLines("estabelecimentos", async (line, label) => {
    if (!stats.files.includes(label)) stats.files.push(label);
    const fields = parseCsvLine(line);
    stats.totalLines++;
    if (stats.totalLines % 1_000_000 === 0) {
      console.log(
        `    … ${stats.totalLines.toLocaleString()} scanned, ${stats.filteredLines.toLocaleString()} kept`,
      );
    }
    if (!passesEstablishmentFilter(fields, ufs, meiSet, stats)) return;
    const row = mapEstablishment(fields);
    if (!row) {
      stats.skippedInvalid++;
      return;
    }
    cnpjSet.add(row[1] as string);
    stats.filteredLines++;
  });
  console.log(
    `\n  Kept ${stats.filteredLines.toLocaleString()} establishments / ${cnpjSet.size.toLocaleString()} companies\n`,
  );
  return cnpjSet;
}

function resolveIngestUrl(): string | undefined {
  const pooler = getDatabaseUrl();
  const direct = process.env.SUPABASE_DB_URL?.trim();
  if (
    pooler &&
    (pooler.includes("pooler") || new URL(pooler).port === "6543") &&
    direct
  ) {
    console.log("Using SUPABASE_DB_URL (direct) instead of pooler DATABASE_URL.\n");
    return direct;
  }
  return pooler;
}

function isLocalDbHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

async function copyEstablishmentsFiltered(
  client: import("pg").Client,
  copyFrom: typeof import("pg-copy-streams").from,
  filePath: string,
  companies: CnpjBitset,
): Promise<number> {
  await client.query("drop table if exists establishments_stage");
  await client.query(
    "create unlogged table establishments_stage (like establishments including defaults)",
  );
  const dest = client.query(
    copyFrom(
      `COPY establishments_stage (${ESTABLISHMENT_COLUMNS.join(", ")}) FROM STDIN WITH (FORMAT text, NULL '\\N')`,
    ),
  );
  const failed = new Promise<never>((_, reject) => {
    dest.once("error", reject);
  });
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let streamed = 0;
  try {
    const filling = (async () => {
      for await (const line of rl) {
        if (!line.trim()) continue;
        const basico = line.split("\t")[1];
        if (!basico || !companies.has(basico)) continue;
        streamed++;
        if (!dest.write(`${line}\n`)) await once(dest, "drain");
      }
      dest.end();
      await once(dest, "finish");
    })();
    await Promise.race([filling, failed]);
  } catch (err) {
    dest.destroy();
    throw err;
  }
  const inserted = await insertNewFromStage(
    client,
    "establishments",
    "establishments_stage",
    ESTABLISHMENT_COLUMNS,
  );
  await client.query("drop table if exists establishments_stage");
  console.log(`  streamed ${streamed.toLocaleString()}, inserted ${inserted.toLocaleString()}`);
  return inserted;
}

async function insertNewFromStage(
  client: import("pg").Client,
  target: string,
  stage: string,
  columns: readonly string[],
): Promise<number> {
  const cols = columns.join(", ");
  const result = await client.query(
    `insert into ${target} (${cols}) select ${cols} from ${stage} on conflict do nothing`,
  );
  return result.rowCount ?? 0;
}

async function copyUniqueInto(
  client: import("pg").Client,
  copyFrom: typeof import("pg-copy-streams").from,
  target: string,
  columns: readonly string[],
  fill: (
    write: (fields: Array<string | number | boolean | null | undefined>) => Promise<void>,
  ) => Promise<void>,
): Promise<number> {
  const stage = `${target}_stage`;
  await client.query(`drop table if exists ${stage}`);
  await client.query(`create unlogged table ${stage} (like ${target} including defaults)`);
  const streamed = await copyWhileStreaming(client, copyFrom, stage, [...columns], fill);
  const inserted = await insertNewFromStage(client, target, stage, columns);
  await client.query(`drop table if exists ${stage}`);
  console.log(`  streamed ${streamed.toLocaleString()}, inserted ${inserted.toLocaleString()}`);
  return inserted;
}

async function loadCompaniesBitset(
  client: import("pg").Client,
): Promise<CnpjBitset> {
  const set = new CnpjBitset();
  let last = "";
  for (;;) {
    const { rows } = await client.query<{ cnpj_basico: string }>(
      `select cnpj_basico from companies
       where cnpj_basico > $1
       order by cnpj_basico
       limit 200000`,
      [last],
    );
    if (!rows.length) break;
    for (const row of rows) set.add(row.cnpj_basico);
    last = rows[rows.length - 1].cnpj_basico;
  }
  return set;
}

async function copyEstablishmentsFromZip(
  client: import("pg").Client,
  copyFrom: typeof import("pg-copy-streams").from,
  ufs: Set<string>,
  meiSet: CnpjBitset,
  companies: CnpjBitset,
  stats: DryRunStats,
): Promise<number> {
  console.log("COPY establishments from RF zips (no TSV)...\n");
  return copyUniqueInto(
    client,
    copyFrom,
    "establishments",
    ESTABLISHMENT_COLUMNS,
    async (write) => {
      await streamKindLines("estabelecimentos", async (line, label) => {
        if (!stats.files.includes(label)) stats.files.push(label);
        const fields = parseCsvLine(line);
        stats.totalLines++;
        if (stats.totalLines % 1_000_000 === 0) {
          console.log(
            `    … ${stats.totalLines.toLocaleString()} scanned, ${stats.filteredLines.toLocaleString()} kept`,
          );
        }
        if (!passesEstablishmentFilter(fields, ufs, meiSet, stats)) return;
        const row = mapEstablishment(fields);
        if (!row) {
          stats.skippedInvalid++;
          return;
        }
        const basico = row[1] as string;
        if (!companies.has(basico)) return;
        stats.filteredLines++;
        await write(row);
      });
    },
  );
}

async function runLiveIngest(ufs: string[]): Promise<void> {
  let Client: typeof import("pg").Client;
  let copyFrom: typeof import("pg-copy-streams").from;
  try {
    ({ Client } = await import("pg"));
  } catch {
    console.error(
      "\nDATABASE_URL is set but the `pg` package is not installed.\n" +
        "Install it with: pnpm add -O pg\n",
    );
    process.exit(1);
  }
  try {
    ({ from: copyFrom } = await import("pg-copy-streams"));
  } catch {
    console.error(
      "\nThe `pg-copy-streams` package is not installed.\n" +
        "Install it with: pnpm add -O pg-copy-streams\n",
    );
    process.exit(1);
  }

  const databaseUrl = resolveIngestUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const local = isLocalDbHost(databaseUrl);
  const client = new Client({
    connectionString: databaseUrl,
    ssl: local ? undefined : { rejectUnauthorized: false },
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  await client.connect();
  await client.query("set synchronous_commit = off");
  await client.query("set statement_timeout = 0");
  console.log("Connected to Postgres.\n");

  const started = Date.now();
  const stats = emptyStats();

  try {
    await applySchema(client);

    const existing = await client.query<{ n: string }>(
      "select count(*)::bigint as n from companies",
    );
    const allBrazil = ufs.length === ALL_UFS.length;
    const resume =
      !allBrazil && Number(existing.rows[0]?.n ?? 0) > 1_000_000;
    const ufSet = new Set(ufs);
    let writtenCompanies: CnpjBitset;
    let companyCount: number;
    let estCount: number;

    if (allBrazil) {
      console.log(
        "Full Brazil ingest: not resuming (companies from a UF subset would drop other states).\n",
      );
    }

    if (resume) {
      console.log(
        `Resuming: ${Number(existing.rows[0].n).toLocaleString()} companies already loaded. Not truncating companies/refs.\n`,
      );
      await client.query(`
        truncate table partners, simples_nacional, establishments
        restart identity cascade
      `);
      for (const sql of LOAD_INDEXES) await client.query(sql);
      writtenCompanies = await loadCompaniesBitset(client);
      companyCount = writtenCompanies.size;
      console.log(`  bitset: ${companyCount.toLocaleString()} company keys\n`);
      // Companies already exclude MEI; skip the 50M-row Simples scan.
      const meiSet = new CnpjBitset();
      estCount = await copyEstablishmentsFromZip(
        client,
        copyFrom,
        ufSet,
        meiSet,
        writtenCompanies,
        stats,
      );
      console.log(`  establishments: ${estCount.toLocaleString()} rows\n`);
    } else {
      console.log("Truncating RF tables...");
      await client.query(`
        truncate table
          partners,
          simples_nacional,
          establishments,
          companies,
          ref_cnae,
          ref_municipio,
          ref_natureza,
          ref_qualificacao
        restart identity cascade
      `);
      for (const sql of LOAD_INDEXES) await client.query(sql);
      console.log("  done\n");

      await copyRefs(client, copyFrom);

      const meiSet = await loadMeiSet();
      const streamOnly = allBrazil;
      let cnpjSet: CnpjBitset;
      let estPath: string | null = null;
      if (streamOnly) {
        const scan = emptyStats();
        cnpjSet = await collectEstablishmentCnpjs(ufSet, meiSet, scan);
      } else {
        const tsv = await writeEstablishmentTsv(ufSet, meiSet, stats);
        estPath = tsv.filePath;
        cnpjSet = tsv.cnpjSet;
      }

      console.log("COPY companies...");
      writtenCompanies = new CnpjBitset();
      companyCount = await copyUniqueInto(
        client,
        copyFrom,
        "companies",
        COMPANY_COLUMNS,
        async (write) => {
          await streamKindLines("empresas", async (line) => {
            const row = mapCompany(parseCsvLine(line));
            if (!row) return;
            const basico = row[0] as string;
            if (!cnpjSet.has(basico) || writtenCompanies.has(basico)) return;
            writtenCompanies.add(basico);
            await write(row);
          });
        },
      );
      console.log(`  companies: ${companyCount.toLocaleString()} rows\n`);

      console.log("COPY establishments...");
      if (estPath && existsSync(estPath)) {
        estCount = await copyEstablishmentsFiltered(
          client,
          copyFrom,
          estPath,
          writtenCompanies,
        );
        rmSync(estPath, { force: true });
      } else {
        estCount = await copyEstablishmentsFromZip(
          client,
          copyFrom,
          ufSet,
          meiSet,
          writtenCompanies,
          stats,
        );
      }
      console.log(`  establishments: ${estCount.toLocaleString()} rows\n`);
    }

    console.log("COPY partners...");
    const partnerCount = await copyWhileStreaming(
      client,
      copyFrom,
      "partners",
      [...PARTNER_COLUMNS],
      async (write) => {
        await streamKindLines("socios", async (line) => {
          const row = mapPartner(parseCsvLine(line));
          if (!row) return;
          if (!writtenCompanies.has(row[0] as string)) return;
          await write(row);
        });
      },
    );
    console.log(`  partners: ${partnerCount.toLocaleString()} rows\n`);

    console.log("COPY simples_nacional...");
    const writtenSimples = new CnpjBitset();
    const simplesCount = await copyUniqueInto(
      client,
      copyFrom,
      "simples_nacional",
      SIMPLES_COLUMNS,
      async (write) => {
        await streamKindLines("simples", async (line) => {
          const row = mapSimples(parseCsvLine(line));
          if (!row) return;
          const basico = row[0] as string;
          if (!writtenCompanies.has(basico) || writtenSimples.has(basico)) return;
          writtenSimples.add(basico);
          await write(row);
        });
      },
    );
    console.log(`  simples_nacional: ${simplesCount.toLocaleString()} rows\n`);

    console.log("Updating município UF from establishments...");
    await client.query(`
      update ref_municipio m
      set uf = e.uf
      from (
        select distinct on (municipio_id) municipio_id, uf
        from establishments
        order by municipio_id
      ) e
      where m.id = e.municipio_id
    `);

    console.log("Creating indexes (after bulk load)...");
    for (const sql of CREATE_INDEXES) {
      process.stdout.write(`  ${sql.slice(0, 60)}...`);
      await client.query(sql);
      console.log(" ok");
    }

    console.log("\nRefreshing materialized views...");
    await client.query(`
      create materialized view if not exists cnae_uf_count as
      select cnae_principal, uf, count(*)::int as n
      from establishments
      group by 1, 2
      with no data
    `);
    await client.query(
      "create unique index if not exists cnae_uf_count_uq on cnae_uf_count (cnae_principal, uf)",
    );
    for (const view of [
      "phone_usage",
      "email_usage",
      "address_usage",
      "phone_shared_verdict",
      "cnae_uf_count",
    ]) {
      process.stdout.write(`  ${view}...`);
      await client.query(`refresh materialized view ${view}`);
      console.log(" ok");
    }

    console.log("\nEnsuring establishments_search table exists...");
    for (const rel of [
      "supabase/migrations/20260824000000_establishments_search.sql",
      "supabase/migrations/20260825000000_es_active_phone_index.sql",
    ]) {
      const migrationSql = readFileSync(path.join(REPO_ROOT, rel), "utf8");
      await client.query(migrationSql);
    }
    console.log(
      "  schema ok — run `pnpm db:populate-search` after this ingest (chunked by UF).\n",
    );

    const duracao = Date.now() - started;
    await client.query(
      `insert into ingest_runs (arquivo, linhas, duracao_ms, hash)
       values ($1, $2, $3, $4)`,
      [
        stats.files.join(",") || describeSources(),
        estCount,
        duracao,
        hashSources(),
      ],
    );

    console.log("\n--- Live ingest summary ---");
    console.log(`Establishments loaded: ${estCount.toLocaleString()}`);
    console.log(`Companies loaded:      ${companyCount.toLocaleString()}`);
    console.log(`Partners loaded:       ${partnerCount.toLocaleString()}`);
    console.log(`Skip (situacao):       ${stats.skippedSituacao.toLocaleString()}`);
    console.log(`Skip (telefone):       ${stats.skippedTelefone.toLocaleString()}`);
    console.log(`Skip (UF):             ${stats.skippedUf.toLocaleString()}`);
    console.log(`Skip (MEI):            ${stats.skippedMei.toLocaleString()}`);
    console.log(`Skip (invalid):        ${stats.skippedInvalid.toLocaleString()}`);
    console.log(`Duration:              ${(duracao / 1000).toFixed(1)}s`);
    console.log(`Sample hash:           ${hashSources()}\n`);
  } finally {
    await client.end();
  }
}

function printDryRunSummary(stats: DryRunStats): void {
  console.log("\n--- Dry-run summary ---");
  console.log(`Files scanned:     ${stats.files.join(", ") || "(none)"}`);
  console.log(`Total rows:        ${stats.totalLines.toLocaleString()}`);
  console.log(`Pass filters:      ${stats.filteredLines.toLocaleString()}`);
  console.log(`Skip (situacao):   ${stats.skippedSituacao.toLocaleString()}`);
  console.log(`Skip (telefone):   ${stats.skippedTelefone.toLocaleString()}`);
  console.log(`Skip (UF):         ${stats.skippedUf.toLocaleString()}`);
  console.log(`Skip (MEI):        ${stats.skippedMei.toLocaleString()}`);
  console.log(`Sample hash:       ${hashSources()}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  printPlan(args.ufs, args.dryRun);

  const databaseUrl = resolveIngestUrl() ?? getDatabaseUrl();

  if (!databaseUrl) {
    console.log("⚠ DATABASE_URL is not set.\n");
    console.log("Running in plan / mock mode — no Postgres writes will occur.");
    console.log("To load for real:");
    console.log("  1. docker compose up -d");
    console.log("  2. Add DATABASE_URL=postgresql://grid:grid@localhost:5432/grid to .env.local");
    console.log("  3. Re-run: pnpm ingest --ufs=ALL\n");
    console.log("The app stays on mock (src/lib/data/mock-store.ts) until supabase-repo is wired.\n");
  }

  const sources = discoverSources();
  if (!sources.length) {
    console.log("No RF files found.");
    console.log("Place 2026-08.zip at the repo root, or zip/CSV files in scripts/ingest/data/.\n");
    return;
  }

  if (args.dryRun || !databaseUrl) {
    console.log("=== Dry-run: counting filtered establishment rows ===\n");
    const stats = await dryRunCount(args.ufs);
    if (!stats.files.length && stats.totalLines === 0) {
      console.log("No Estabelecimentos files found inside the dump.\n");
    } else {
      printDryRunSummary(stats);
    }
    if (!databaseUrl) return;
  }

  if (databaseUrl && !args.dryRun) {
    await runLiveIngest(args.ufs);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
