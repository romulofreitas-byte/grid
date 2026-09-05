import ExcelJS from "exceljs";
import { parseCsvText, type SpreadsheetTable } from "@/lib/crm/import-file";
import { IMPORT_MAX_ROWS } from "@/lib/crm/schema";

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return cellText(value.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

export async function parseSpreadsheetBuffer(
  buffer: ArrayBuffer | Buffer | Uint8Array,
  filename: string,
  maxRows = IMPORT_MAX_ROWS,
): Promise<SpreadsheetTable> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = Buffer.from(buffer as ArrayBuffer).toString("utf8");
    return parseCsvText(text, maxRows);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(buffer));
  const sheet = wb.worksheets[0];
  if (!sheet) return { headers: [], rows: [], truncated: false };
  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      while (cells.length < colNumber - 1) cells.push("");
      cells.push(cellText(cell.value));
    });
    if (cells.some((cell) => cell.length > 0)) matrix.push(cells);
  });
  if (matrix.length === 0) return { headers: [], rows: [], truncated: false };
  const width = Math.max(...matrix.map((row) => row.length));
  const padded = matrix.map((row) => {
    if (row.length >= width) return row.slice(0, width);
    return [...row, ...Array(width - row.length).fill("")];
  });
  const headers = padded[0]!.map((cell, index) => cell || `coluna_${index + 1}`);
  const body = padded.slice(1);
  return {
    headers,
    rows: body.slice(0, maxRows),
    truncated: body.length > maxRows,
  };
}
