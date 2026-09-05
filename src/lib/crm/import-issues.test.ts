import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/copy";
import { mapImportLead, parseImportCnpj } from "./import";
import { IMPORT_CREATE_FAILED_MESSAGE } from "./import-issues";
import {
  classifyImportIssue,
  correctionFileName,
  emptyImportFields,
  groupImportIssues,
  importIssueDiagnosis,
  issueGroupLabel,
  joinPt,
} from "./import-issues";
import type { CrmImportRunIssue } from "./types";

function issue(
  partial: Partial<CrmImportRunIssue> & Pick<CrmImportRunIssue, "row" | "message">,
): CrmImportRunIssue {
  return {
    status: "error",
    company: "",
    name: "",
    phone: "",
    email: "",
    cnpj: "",
    ...partial,
  };
}

describe("import issue catalog", () => {
  it("classifies the messages mapImportLead and apply persist", () => {
    const empty = mapImportLead({});
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(classifyImportIssue(empty.message).code).toBe("empty_row");

    expect(classifyImportIssue(parseImportCnpj("123456789012345").error ?? "").code).toBe(
      "invalid_cnpj",
    );
    expect(classifyImportIssue(IMPORT_CREATE_FAILED_MESSAGE).code).toBe(
      "create_failed",
    );
  });

  it("keeps empty-row and invalid-cnpj actions usable", () => {
    expect(classifyImportIssue("Linha vazia")).toMatchObject({
      title: COPY.importacoesIssueEmptyTitle,
      action: COPY.importacoesIssueEmptyAction,
    });
    expect(classifyImportIssue("CNPJ inválido").action).toBe(
      COPY.importacoesIssueCnpjAction,
    );
  });

  it("groups repeated empty rows under one reason", () => {
    const groups = groupImportIssues([
      issue({ row: 2, message: "Linha vazia" }),
      issue({ row: 3, message: "Linha vazia" }),
      issue({ row: 4, message: "CNPJ inválido", company: "Padaria", cnpj: "12" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.kind.code).toBe("empty_row");
    expect(groups[0]?.issues).toHaveLength(2);
    expect(issueGroupLabel(groups[0]!.kind, 2)).toBe(
      `${COPY.importacoesIssueEmptyTitle} — 2 linhas`,
    );
    expect(groups[1]?.kind.code).toBe("invalid_cnpj");
  });

  it("diagnoses empty fields and the CNPJ that arrived", () => {
    expect(
      importIssueDiagnosis(issue({ row: 2, message: "Linha vazia" })),
    ).toBe("Vazio: Empresa, Nome, Telefone, E-mail e CNPJ");
    expect(
      emptyImportFields(
        issue({ row: 2, message: "Linha vazia", name: "Maria" }),
      ),
    ).toEqual(["company", "phone", "email", "cnpj"]);
    expect(
      importIssueDiagnosis(
        issue({
          row: 4,
          message: "CNPJ inválido",
          company: "Padaria",
          cnpj: "12.345",
        }),
      ),
    ).toBe("Padaria · CNPJ recebido: 12.345");
  });

  it("joins Portuguese lists and prefixes a correction file name", () => {
    expect(joinPt(["Empresa"])).toBe("Empresa");
    expect(joinPt(["Empresa", "Nome"])).toBe("Empresa e Nome");
    expect(correctionFileName("Mapas BH.csv")).toBe("correção · Mapas BH.csv");
    expect(correctionFileName("correção · Mapas BH.csv")).toBe(
      "correção · Mapas BH.csv",
    );
  });
});
