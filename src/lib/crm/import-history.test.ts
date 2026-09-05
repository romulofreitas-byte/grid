import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/copy";
import {
  importErrorCsvFilename,
  importErrorRowsCsv,
  importRunTone,
  issuesFromApply,
  parseImportRunIssues,
  snapshotImportIssue,
} from "./import-history";
import { IMPORT_SKIPPED_MESSAGE } from "./import-history";

describe("import history", () => {
  it("snapshots the original cells next to the error", () => {
    expect(
      snapshotImportIssue(
        { company: "Padaria", cnpj: "12.345" },
        { row: 4, status: "error", message: "CNPJ inválido" },
      ),
    ).toEqual({
      row: 4,
      status: "error",
      message: "CNPJ inválido",
      company: "Padaria",
      name: "",
      phone: "",
      email: "",
      cnpj: "12.345",
    });
  });

  it("builds a semicolon CSV that Excel in pt-BR can open", () => {
    const csv = importErrorRowsCsv([
      {
        row: 3,
        status: "error",
        message: "CNPJ inválido",
        company: "Oficina; Centro",
        name: "Ana",
        phone: "",
        email: "",
        cnpj: "123",
      },
      {
        row: 4,
        status: "skipped",
        message: IMPORT_SKIPPED_MESSAGE,
        company: "Já tem",
        name: "",
        phone: "",
        email: "",
        cnpj: "",
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("linha;erro;o_que_fazer;empresa");
    expect(csv).toContain(
      `3;CNPJ inválido;${COPY.importacoesIssueCnpjAction};"Oficina; Centro";Ana;;;123`,
    );
    expect(csv).not.toContain("Já tem");
    expect(importErrorCsvFilename("Mapas BH.xlsx")).toBe("erros-Mapas-BH.csv");
  });

  it("keeps skipped and errors in the persisted issues", () => {
    const issues = issuesFromApply(
      [
        { company: "Padaria", cnpj: "bad" },
        { name: "Maria", email: "m@x.com" },
      ],
      {
        created: 0,
        skipped: 1,
        errors: [{ row: 1, message: "CNPJ inválido" }],
        issues: [
          { row: 1, status: "error", message: "CNPJ inválido" },
          { row: 2, status: "skipped", message: IMPORT_SKIPPED_MESSAGE },
        ],
        deals: [],
      },
    );
    expect(issues).toHaveLength(2);
    expect(issues[0]?.company).toBe("Padaria");
    expect(issues[1]?.status).toBe("skipped");
  });

  it("drops malformed persisted issues", () => {
    expect(parseImportRunIssues([{ row: "x" }, { row: 2, status: "error" }])).toEqual(
      [
        {
          row: 2,
          status: "error",
          message: "",
          company: "",
          name: "",
          phone: "",
          email: "",
          cnpj: "",
        },
      ],
    );
    expect(importRunTone({ created: 3, skipped: 0, error_count: 1 })).toBe("warning");
    expect(importRunTone({ created: 3, skipped: 1, error_count: 0 })).toBe("success");
  });
});
