import { describe, expect, it } from "vitest";
import { parseCsvText, rowToRecord } from "./import-file";

describe("import file csv", () => {
  it("parses semicolon CSV from Excel BR", () => {
    const table = parseCsvText(
      "Empresa;Nome;Telefone\nPadaria;Maria;11999999999\nOficina;João;11888888888\n",
    );
    expect(table.headers).toEqual(["Empresa", "Nome", "Telefone"]);
    expect(table.rows).toEqual([
      ["Padaria", "Maria", "11999999999"],
      ["Oficina", "João", "11888888888"],
    ]);
  });

  it("maps columns onto import fields", () => {
    const record = rowToRecord(
      ["Empresa", "Nome"],
      ["Padaria", "Maria"],
      ["company", "name"],
    );
    expect(record).toEqual({ company: "Padaria", name: "Maria" });
  });

  it("joins two notes columns", () => {
    const record = rowToRecord(
      ["Empresa", "Anotações", "Histórico"],
      ["Padaria", "Lead Ads", "Pediu retorno"],
      ["company", "notes", "notes"],
    );
    expect(record).toEqual({
      company: "Padaria",
      notes: "Lead Ads · Pediu retorno",
    });
  });

  it("strips BOM and quoted cells", () => {
    const table = parseCsvText('\uFEFF"Nome","E-mail"\n"Silva, Maria","a@b.com"\n');
    expect(table.headers).toEqual(["Nome", "E-mail"]);
    expect(table.rows[0]).toEqual(["Silva, Maria", "a@b.com"]);
  });
});
