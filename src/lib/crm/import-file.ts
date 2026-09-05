import { IMPORT_MAX_ROWS } from "@/lib/crm/schema";

export type SpreadsheetTable = {
  headers: string[];
  rows: string[][];
  truncated: boolean;
};

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const comma = (headerLine.match(/,/g) ?? []).length;
  const semi = (headerLine.match(/;/g) ?? []).length;
  const tab = (headerLine.match(/\t/g) ?? []).length;
  if (tab > comma && tab > semi) return "\t";
  if (semi > comma) return ";";
  return ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delimiter) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

export function parseCsvText(text: string, maxRows = IMPORT_MAX_ROWS): SpreadsheetTable {
  const normalized = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], truncated: false };
  }
  const delimiter = detectDelimiter(lines[0]!);
  const headers = parseCsvLine(lines[0]!, delimiter);
  const body = lines.slice(1);
  const truncated = body.length > maxRows;
  const rows = body.slice(0, maxRows).map((line) => {
    const cells = parseCsvLine(line, delimiter);
    if (cells.length >= headers.length) return cells.slice(0, headers.length);
    return [...cells, ...Array(headers.length - cells.length).fill("")];
  });
  return { headers, rows, truncated };
}

export function isSpreadsheetName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv")
  );
}

export function isXlsxName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

export function rowToRecord(
  headers: string[],
  row: string[],
  mapping: Array<"company" | "name" | "phone" | "email" | "cnpj" | "notes" | "skip">,
): Record<string, string> {
  const out: Record<string, string> = {};
  mapping.forEach((key, index) => {
    if (key === "skip") return;
    const value = (row[index] ?? "").trim();
    if (!value) return;
    out[key] = out[key] ? `${out[key]} · ${value}` : value;
  });
  void headers;
  return out;
}
