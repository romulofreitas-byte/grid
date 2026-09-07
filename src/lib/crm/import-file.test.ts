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
    expect(table.foldedLines).toBe(0);
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

  it("keeps quoted newlines as one company row", () => {
    const table = parseCsvText(
      [
        "nome,cnpj,Notas,socios",
        'Metalúrgica São Sebastião LTDA,17.248.113/0001-03,"marcospantuzzo@metalss.com.br',
        "",
        'Isabela atendeu disse que contato só por email",MARCOS PANTUZZO',
        'Metalúrgica Vaz,09.112.275/0001-91,já fazem boas ações,"',
        'PAULO AFONSO VAZ"',
        'Dias Recuperadora,"',
        '17.251.265/0001-65",notas da live,JOSE MAURICIO',
        'JRG Metals,,"Falei com Raphael, ele disse que tem que falar com o Dono',
        "",
        'Disse que hoje olharam a parte de marketing",Raphael Augusto',
      ].join("\n"),
    );
    expect(table.rows).toHaveLength(4);
    expect(table.foldedLines).toBeGreaterThanOrEqual(4);
    expect(table.rows[0]?.[0]).toBe("Metalúrgica São Sebastião LTDA");
    expect(table.rows[0]?.[2]).toMatch(/Isabela atendeu/);
    expect(table.rows[1]?.[0]).toBe("Metalúrgica Vaz");
    expect(table.rows[1]?.[3]).toMatch(/PAULO AFONSO VAZ/);
    expect(table.rows[2]?.[0]).toBe("Dias Recuperadora");
    expect(table.rows[2]?.[1]).toMatch(/17\.251\.265\/0001-65/);
    expect(table.rows[3]?.[0]).toBe("JRG Metals");
    expect(table.rows.every((row) => !/^Isabela atendeu/.test(row[0] ?? ""))).toBe(
      true,
    );
    expect(table.rows.every((row) => !/^Falei com Raphael/.test(row[0] ?? ""))).toBe(
      true,
    );
  });
});
