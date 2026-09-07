import { IMPORT_MAX_ROWS } from "@/lib/crm/schema";

export type SpreadsheetTable = {
  headers: string[];
  rows: string[][];
  truncated: boolean;
  /** Newlines that lived inside quoted cells and were folded into one row. */
  foldedLines: number;
};

export type ImportFileColumnKey =
  | "company"
  | "name"
  | "phone"
  | "email"
  | "cnpj"
  | "notes"
  | "people"
  | "website"
  | "instagram"
  | "address"
  | "skip";

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

function firstUnquotedLine(text: string): string {
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          i += 1;
          continue;
        }
        quoted = false;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === "\n") return text.slice(0, i);
  }
  return text;
}

function padRow(cells: string[], width: number): string[] {
  if (cells.length >= width) return cells.slice(0, width);
  return [...cells, ...Array(width - cells.length).fill("")];
}

function parseCsvRecords(
  text: string,
  delimiter: string,
): { records: string[][]; foldedLines: number } {
  const records: string[][] = [];
  let row: string[] = [];
  let current = "";
  let quoted = false;
  let foldedLines = 0;

  const pushCell = () => {
    row.push(current.trim());
    current = "";
  };

  const pushRow = () => {
    pushCell();
    if (row.some((cell) => cell.length > 0)) records.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
        continue;
      }
      if (ch === "\n") foldedLines += 1;
      current += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delimiter) {
      pushCell();
      continue;
    }
    if (ch === "\n") {
      pushRow();
      continue;
    }
    current += ch;
  }
  if (quoted || current.length > 0 || row.length > 0) pushRow();
  return { records, foldedLines };
}

export function parseCsvText(text: string, maxRows = IMPORT_MAX_ROWS): SpreadsheetTable {
  const normalized = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.trim()) {
    return { headers: [], rows: [], truncated: false, foldedLines: 0 };
  }
  const delimiter = detectDelimiter(firstUnquotedLine(normalized));
  const { records, foldedLines } = parseCsvRecords(normalized, delimiter);
  if (records.length === 0) {
    return { headers: [], rows: [], truncated: false, foldedLines };
  }
  const headers = records[0]!;
  const body = records.slice(1);
  const truncated = body.length > maxRows;
  const width = headers.length;
  const rows = body.slice(0, maxRows).map((row) => padRow(row, width));
  return { headers, rows, truncated, foldedLines };
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

const JOIN_SEP: Partial<Record<ImportFileColumnKey, string>> = {
  notes: " · ",
  phone: " · ",
  people: " / ",
};

export function rowToRecord(
  headers: string[],
  row: string[],
  mapping: ImportFileColumnKey[],
): Record<string, string> {
  const out: Record<string, string> = {};
  mapping.forEach((key, index) => {
    if (key === "skip") return;
    const value = (row[index] ?? "").trim();
    if (!value) return;
    const sep = JOIN_SEP[key];
    if (out[key] && sep) {
      out[key] = `${out[key]}${sep}${value}`;
      return;
    }
    if (out[key]) return;
    out[key] = value;
  });
  void headers;
  return out;
}
