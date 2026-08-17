#!/usr/bin/env tsx
/**
 * Download Receita Federal CNPJ open-data zips into scripts/ingest/data/.
 */

import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { DATA_DIR, RF_BASE_URL } from "./config";

const FILES = [
  "Cnaes.zip",
  "Municipios.zip",
  "Naturezas.zip",
  "Qualificacoes.zip",
  "Simples.zip",
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Empresas${n}.zip`),
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Estabelecimentos${n}.zip`),
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Socios${n}.zip`),
];

function monthCandidates(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push(ym);
  }
  return months;
}

function bases(): string[] {
  const env = (process.env.RF_CNPJ_BASE_URL ?? RF_BASE_URL).replace(/\/+$/, "");
  const out = [env];
  if (!/\/\d{4}-\d{2}$/.test(env)) {
    for (const m of monthCandidates()) out.push(`${env}/${m}`);
  }
  out.push("https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj");
  out.push("https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj");
  for (const m of monthCandidates()) {
    out.push(
      `https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/${m}`,
    );
    out.push(`https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/${m}`);
  }
  return [...new Set(out)];
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) return true;
    const get = await fetch(url, { method: "GET", redirect: "follow" });
    return get.ok;
  } catch {
    return false;
  }
}

async function resolveBase(): Promise<string> {
  for (const base of bases()) {
    const probe = `${base}/Cnaes.zip`;
    process.stdout.write(`Probing ${probe} ... `);
    if (await headOk(probe)) {
      console.log("ok");
      return base;
    }
    console.log("no");
  }
  throw new Error(
    "Could not find a live Receita Federal dump. Set RF_CNPJ_BASE_URL to the monthly folder.",
  );
}

async function downloadFile(url: string, dest: string): Promise<void> {
  if (existsSync(dest) && statSync(dest).size > 1024) {
    console.log(`  skip (exists) ${path.basename(dest)}`);
    return;
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`GET ${url} → ${res.status}`);
  }
  const tmp = `${dest}.part`;
  await pipeline(res.body, createWriteStream(tmp));
  const { renameSync } = await import("node:fs");
  renameSync(tmp, dest);
  const mb = (statSync(dest).size / 1024 / 1024).toFixed(1);
  console.log(`  saved ${path.basename(dest)} (${mb} MB)`);
}

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const base = await resolveBase();
  console.log(`\nDownloading into ${DATA_DIR}\n`);
  for (const file of FILES) {
    const url = `${base}/${file}`;
    const dest = path.join(DATA_DIR, file);
    try {
      await downloadFile(url, dest);
    } catch (err) {
      console.warn(`  WARN ${file}: ${(err as Error).message}`);
    }
  }
  console.log("\nDone. Next: pnpm ingest --ufs=MG,SP\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
