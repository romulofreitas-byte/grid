/**
 * Postgres COPY FROM STDIN helpers (text/TSV).
 */

import { createReadStream } from "node:fs";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import type { Writable } from "node:stream";
import type { Client } from "pg";

type CopyFromFn = (query: string) => Writable;

export function tsvEscape(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "\\N";
  if (typeof value === "boolean") return value ? "t" : "f";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "\\N";
  }
  if (value === "") return "\\N";
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

export function pgTextArray(items: string[]): string {
  if (!items.length) return "{}";
  return `{${items.map((item) => `"${item.replace(/"/g, '\\"')}"`).join(",")}}`;
}

export function toTsvLine(fields: Array<string | number | boolean | null | undefined>): string {
  return fields.map(tsvEscape).join("\t") + "\n";
}

export async function copyFromTsvFile(
  client: Client,
  copyFrom: CopyFromFn,
  table: string,
  columns: string[],
  filePath: string,
): Promise<void> {
  const dest = client.query(
    copyFrom(
      `COPY ${table} (${columns.join(", ")}) FROM STDIN WITH (FORMAT text, NULL '\\N')`,
    ),
  );
  await pipeline(createReadStream(filePath, { encoding: "utf8" }), dest);
}

export async function copyWhileStreaming(
  client: Client,
  copyFrom: CopyFromFn,
  table: string,
  columns: string[],
  fill: (
    write: (fields: Array<string | number | boolean | null | undefined>) => Promise<void>,
  ) => Promise<void>,
): Promise<number> {
  const dest = client.query(
    copyFrom(
      `COPY ${table} (${columns.join(", ")}) FROM STDIN WITH (FORMAT text, NULL '\\N')`,
    ),
  );

  const failed = new Promise<never>((_, reject) => {
    dest.once("error", reject);
  });

  let count = 0;
  const write = async (
    fields: Array<string | number | boolean | null | undefined>,
  ): Promise<void> => {
    const line = toTsvLine(fields);
    count++;
    if (!dest.write(line)) await once(dest, "drain");
  };

  try {
    await Promise.race([fill(write), failed]);
    dest.end();
    await Promise.race([once(dest, "finish"), failed]);
  } catch (err) {
    dest.destroy();
    throw err;
  }
  return count;
}
