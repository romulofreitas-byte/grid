import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseSpreadsheetBuffer } from "./import-xlsx";

describe("import xlsx", () => {
  it("reads the first sheet headers and rows", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Leads");
    sheet.addRow(["Empresa", "Nome", "E-mail"]);
    sheet.addRow(["Padaria", "Maria", "maria@x.com"]);
    const buf = await wb.xlsx.writeBuffer();
    const table = await parseSpreadsheetBuffer(buf, "leads.xlsx");
    expect(table.headers).toEqual(["Empresa", "Nome", "E-mail"]);
    expect(table.rows).toEqual([["Padaria", "Maria", "maria@x.com"]]);
  });
});
