#!/usr/bin/env tsx
/**
 * Import Mundo Pódium audience e-mails into platform_subscribers.
 *
 * Fonte (primeira que existir):
 *   data/platform-audience.csv
 *   supabase/community_mundo_podium_356405_1787003890_audience_list.csv (arquivo ou pasta)
 *   supabase/community_mundo_podium_356405_1787003890_audience_list.csv.zip
 *   supabase/*audience*.csv / supabase/*audience*.zip
 *
 *   pnpm seed:platform-audience
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabaseUrl, REPO_ROOT } from "../ingest/config";

const DATA_DIR = path.join(REPO_ROOT, "data");
const CSV_OUT = path.join(DATA_DIR, "platform-audience.csv");
const ZIP_NAME =
  "community_mundo_podium_356405_1787003890_audience_list.csv.zip";
const AUDIENCE_BASENAME =
  "community_mundo_podium_356405_1787003890_audience_list.csv";

function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase().replace(/^"|"$/g, "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** RFC-style CSV rows (campos entre aspas podem ter vírgula e quebra de linha). */
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || (c === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim())) records.push(row);
      row = [];
      if (c === "\r") i++;
    } else if (c !== "\r") {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) records.push(row);
  }
  return records;
}

export function parseCsvEmails(text: string): string[] {
  const records = parseCsvRecords(text);
  if (!records.length) return [];
  const header = records[0]!.map((h) => h.trim().toLowerCase());
  const emailIdx = header.findIndex((h) =>
    ["email", "email address", "e-mail", "e-mail address"].includes(h),
  );
  const emails = new Set<string>();
  for (let i = 1; i < records.length; i++) {
    const cols = records[i]!;
    const raw =
      emailIdx >= 0 ? (cols[emailIdx] ?? "") : (cols[0] ?? "");
    const email = normalizeEmail(raw);
    if (email) emails.add(email);
  }
  return [...emails];
}

export function resolveAudienceCsvPath(candidate: string): string | null {
  if (!existsSync(candidate)) return null;
  const st = statSync(candidate);
  if (st.isFile()) return candidate;
  if (!st.isDirectory()) return null;

  const sameNameInside = path.join(candidate, path.basename(candidate));
  if (existsSync(sameNameInside) && statSync(sameNameInside).isFile()) {
    return sameNameInside;
  }
  for (const name of readdirSync(candidate)) {
    if (name.toLowerCase().endsWith(".csv")) {
      const inner = path.join(candidate, name);
      if (statSync(inner).isFile()) return inner;
    }
  }
  return null;
}

async function extractZipToCsv(zipPath: string, outPath: string): Promise<void> {
  const yauzl = await import("yauzl");
  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err ?? new Error("zip open failed"));
      let found = false;
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        if (!entry.fileName.endsWith(".csv")) {
          zipfile.readEntry();
          return;
        }
        found = true;
        zipfile.openReadStream(entry, (e2, stream) => {
          if (e2 || !stream) return reject(e2 ?? new Error("stream failed"));
          const chunks: Buffer[] = [];
          stream.on("data", (c) => chunks.push(c as Buffer));
          stream.on("end", () => {
            mkdirSync(path.dirname(outPath), { recursive: true });
            writeFileSync(outPath, Buffer.concat(chunks));
            zipfile.close();
            resolve();
          });
          stream.on("error", reject);
        });
      });
      zipfile.on("end", () => {
        if (!found) reject(new Error("no csv in zip"));
      });
      zipfile.on("error", reject);
    });
  });
}

async function resolveSourceCsv(): Promise<string> {
  if (existsSync(CSV_OUT)) return CSV_OUT;

  const namedBase = path.join(REPO_ROOT, "supabase", AUDIENCE_BASENAME);
  const fromNamed = resolveAudienceCsvPath(namedBase);
  if (fromNamed) return fromNamed;

  const namedZip = path.join(REPO_ROOT, "supabase", ZIP_NAME);
  if (existsSync(namedZip) && statSync(namedZip).isFile()) {
    mkdirSync(DATA_DIR, { recursive: true });
    await extractZipToCsv(namedZip, CSV_OUT);
    return CSV_OUT;
  }

  const supabaseDir = path.join(REPO_ROOT, "supabase");
  if (existsSync(supabaseDir)) {
    for (const name of readdirSync(supabaseDir)) {
      const full = path.join(supabaseDir, name);
      if (/audience/i.test(name)) {
        const csv = resolveAudienceCsvPath(full);
        if (csv) return csv;
        if (/\.zip$/i.test(name) && statSync(full).isFile()) {
          mkdirSync(DATA_DIR, { recursive: true });
          await extractZipToCsv(full, CSV_OUT);
          return CSV_OUT;
        }
      }
    }
  }

  throw new Error(
    `Audience CSV not found. Place ${AUDIENCE_BASENAME} (file or folder) or ${ZIP_NAME} in supabase/, or data/platform-audience.csv`,
  );
}

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");

  const csvPath = await resolveSourceCsv();
  console.log(`Reading ${csvPath}`);
  const emails = parseCsvEmails(readFileSync(csvPath, "utf8"));
  if (!emails.length) throw new Error(`No e-mails parsed from ${csvPath}`);

  const migration = path.join(
    REPO_ROOT,
    "supabase/migrations/20260822000000_platform_subscribers.sql",
  );
  const sql = readFileSync(migration, "utf8");

  const { Client } = await import("pg");
  const local = (() => {
    try {
      const host = new URL(url).hostname;
      return host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
      return false;
    }
  })();
  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    let inserted = 0;
    for (const email of emails) {
      const res = await client.query(
        `insert into platform_subscribers (email) values ($1)
         on conflict (email) do nothing`,
        [email],
      );
      if (res.rowCount) inserted += 1;
    }
    const { rows } = await client.query<{ n: number }>(
      `select count(*)::int as n from platform_subscribers`,
    );
    console.log(
      `platform_subscribers: ${rows[0]?.n ?? 0} total (${inserted} new from ${emails.length} in file)`,
    );
  } finally {
    await client.end();
  }
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
