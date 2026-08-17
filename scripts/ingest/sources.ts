/**
 * Discover RF dumps and stream CSV lines from nested zips (one inner zip at a time).
 */

import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { pipeline } from "node:stream/promises";
import { openPromise } from "yauzl";
import type { Entry, ZipFile } from "yauzl";
import {
  DATA_DIR,
  EXTRACT_DIR,
  ROOT_MONTH_DIR,
  ROOT_MONTH_ZIP,
} from "./config";
import {
  isDirectoryEntry,
  isMonthDumpZip,
  isRfZip,
  isSkippedArchive,
  matchesKindEntry,
  matchesKindZip,
  type RfKind,
} from "./kinds";

export type DataSource =
  | { type: "nested-zip"; path: string }
  | { type: "zip"; path: string }
  | { type: "file"; path: string };

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function readLatin1Lines(
  zip: ZipFile,
  entry: Entry,
  onLine: (line: string) => void | Promise<void>,
): Promise<number> {
  const stream = await zip.openReadStreamPromise(entry);
  stream.setEncoding("latin1");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    await onLine(line);
    count++;
  }
  return count;
}

function isZipDataEntry(fileName: string): boolean {
  if (isDirectoryEntry(fileName)) return false;
  return !fileName.toLowerCase().endsWith(".zip");
}

function walkFiles(dir: string, maxDepth: number, depth = 0): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory() || depth > maxDepth) {
    return [];
  }
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === ".extracted" || name === ".git") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkFiles(full, maxDepth, depth + 1));
    } else {
      out.push(full);
    }
  }
  return out;
}

function collectFromDir(dir: string): DataSource[] {
  if (!existsSync(dir)) return [];
  const sources: DataSource[] = [];
  for (const file of walkFiles(dir, 2)) {
    const base = path.basename(file);
    if (isSkippedArchive(base)) continue;
    if (file.toLowerCase().endsWith(".zip")) {
      sources.push({
        type: isMonthDumpZip(base) ? "nested-zip" : "zip",
        path: file,
      });
      continue;
    }
    sources.push({ type: "file", path: file });
  }
  return sources;
}

export function discoverSources(): DataSource[] {
  const fromData = collectFromDir(DATA_DIR).filter(
    (s) => s.type === "nested-zip" || s.type === "zip" || s.type === "file",
  );
  const useful = fromData.filter((s) => {
    if (s.type === "nested-zip") return true;
    if (s.type === "zip") return isRfZip(s.path);
    return true;
  });
  if (useful.length) return useful;

  const sources: DataSource[] = [];
  if (existsSync(ROOT_MONTH_ZIP) && statSync(ROOT_MONTH_ZIP).isFile()) {
    sources.push({ type: "nested-zip", path: ROOT_MONTH_ZIP });
  }
  if (existsSync(ROOT_MONTH_DIR) && statSync(ROOT_MONTH_DIR).isDirectory()) {
    sources.push(...collectFromDir(ROOT_MONTH_DIR));
  }
  return sources;
}

export function describeSources(sources: DataSource[] = discoverSources()): string {
  if (!sources.length) return "(none)";
  return sources
    .map((s) => `${s.type}:${path.relative(process.cwd(), s.path) || path.basename(s.path)}`)
    .join(", ");
}

async function streamPlainFile(
  filePath: string,
  onLine: (line: string) => void | Promise<void>,
): Promise<number> {
  const stream = createReadStream(filePath, { encoding: "latin1" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    await onLine(line);
    count++;
  }
  return count;
}

async function streamZipDataFile(
  zipPath: string,
  kind: RfKind,
  onLine: (line: string) => void | Promise<void>,
): Promise<number> {
  const zip = await openPromise(zipPath);
  const fallbackNames: string[] = [];
  let count = 0;
  let matched = false;
  try {
    for await (const entry of zip.eachEntry()) {
      if (!isZipDataEntry(entry.fileName)) continue;
      if (matchesKindEntry(entry.fileName, kind)) {
        matched = true;
        count += await readLatin1Lines(zip, entry, onLine);
        continue;
      }
      fallbackNames.push(entry.fileName);
    }
  } finally {
    try {
      zip.close();
    } catch {
      // already closed
    }
  }

  if (matched) return count;
  if (fallbackNames.length !== 1) {
    console.warn(`  ⚠ No ${kind} data file inside ${path.basename(zipPath)}`);
    return 0;
  }

  const zip2 = await openPromise(zipPath);
  try {
    for await (const entry of zip2.eachEntry()) {
      if (entry.fileName !== fallbackNames[0]) continue;
      count += await readLatin1Lines(zip2, entry, onLine);
      break;
    }
  } finally {
    try {
      zip2.close();
    } catch {
      // already closed
    }
  }
  return count;
}

async function forEachInnerZip(
  outerPath: string,
  kind: RfKind,
  fn: (tempZipPath: string, label: string) => Promise<void>,
): Promise<void> {
  ensureDir(path.join(EXTRACT_DIR, "inner"));
  const zip = await openPromise(outerPath);
  try {
    for await (const entry of zip.eachEntry()) {
      if (isDirectoryEntry(entry.fileName)) continue;
      if (!entry.fileName.toLowerCase().endsWith(".zip")) continue;
      if (isSkippedArchive(entry.fileName)) continue;
      if (!matchesKindZip(entry.fileName, kind)) continue;

      const tempPath = path.join(EXTRACT_DIR, "inner", path.basename(entry.fileName));
      const rs = await zip.openReadStreamPromise(entry);
      await pipeline(rs, createWriteStream(tempPath));
      try {
        await fn(tempPath, entry.fileName);
      } finally {
        rmSync(tempPath, { force: true });
      }
    }
  } finally {
    try {
      zip.close();
    } catch {
      // already closed
    }
  }
}

export async function streamKindLines(
  kind: RfKind,
  onLine: (line: string, label: string) => void | Promise<void>,
): Promise<{ files: string[]; lines: number }> {
  const sources = discoverSources();
  const files: string[] = [];
  let lines = 0;

  for (const source of sources) {
    if (source.type === "nested-zip") {
      await forEachInnerZip(source.path, kind, async (tempPath, label) => {
        files.push(label);
        process.stdout.write(`  ${label}...`);
        const n = await streamZipDataFile(tempPath, kind, (line) =>
          onLine(line, label),
        );
        lines += n;
        console.log(` ${n.toLocaleString()} lines`);
      });
      continue;
    }

    if (source.type === "zip") {
      if (!matchesKindZip(source.path, kind)) continue;
      const label = path.basename(source.path);
      files.push(label);
      process.stdout.write(`  ${label}...`);
      const n = await streamZipDataFile(source.path, kind, (line) =>
        onLine(line, label),
      );
      lines += n;
      console.log(` ${n.toLocaleString()} lines`);
      continue;
    }

    if (!matchesKindEntry(source.path, kind)) continue;
    const label = path.basename(source.path);
    files.push(label);
    process.stdout.write(`  ${label}...`);
    const n = await streamPlainFile(source.path, (line) => onLine(line, label));
    lines += n;
    console.log(` ${n.toLocaleString()} lines`);
  }

  return { files, lines };
}
