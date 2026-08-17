#!/usr/bin/env tsx
/**
 * Import Mundo Pódium audience e-mails into platform_subscribers.
 *
 * Fonte (primeira que existir):
 *   data/platform-audience.csv
 *   supabase/community_mundo_podium_356405_1787003890_audience_list.csv
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
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { getDatabaseUrl, REPO_ROOT } from "../ingest/config";

const DATA_DIR = path.join(REPO_ROOT, "data");
const CSV_OUT = path.join(DATA_DIR, "platform-audience.csv");
const ZIP_NAME =
  "community_mundo_podium_356405_1787003890_audience_list.csv.zip";

function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase().replace(/^"|"$/g, "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function parseCsvEmails(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const emailIdx = header.findIndex((h) =>
    ["email", "email address", "e-mail", "e-mail address"].includes(h),
  );
  const emails = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",");
    const raw =
      emailIdx >= 0 ? (cols[emailIdx] ?? "") : (cols[0] ?? lines[i]!);
    const email = normalizeEmail(raw);
    if (email) emails.add(email);
  }
  return [...emails];
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

  const namedCsv = path.join(REPO_ROOT, "supabase", ZIP_NAME.replace(".zip", ""));
  if (existsSync(namedCsv)) return namedCsv;

  const namedZip = path.join(REPO_ROOT, "supabase", ZIP_NAME);
  if (existsSync(namedZip)) {
    mkdirSync(DATA_DIR, { recursive: true });
    await extractZipToCsv(namedZip, CSV_OUT);
    return CSV_OUT;
  }

  const supabaseDir = path.join(REPO_ROOT, "supabase");
  if (existsSync(supabaseDir)) {
    for (const name of readdirSync(supabaseDir)) {
      const full = path.join(supabaseDir, name);
      if (/audience.*\.csv$/i.test(name)) return full;
      if (/audience.*\.zip$/i.test(name)) {
        mkdirSync(DATA_DIR, { recursive: true });
        await extractZipToCsv(full, CSV_OUT);
        return CSV_OUT;
      }
    }
  }

  throw new Error(
    `Audience CSV not found. Place ${ZIP_NAME} in supabase/ or data/platform-audience.csv`,
  );
}

async function main(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");

  const csvPath = await resolveSourceCsv();
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
