import { describe, expect, it } from "vitest";
import type { CompanySearchHit, GridRow } from "@/lib/types";
import {
  companyHitToPreview,
  gridRowToPreview,
  leadPreviewKey,
  leadQueryKey,
  normalizeLeadCnpj,
} from "./lead-query";

const row: GridRow = {
  cnpj: "12345678000190",
  razaoSocial: "Padaria Centro Ltda",
  nomeFantasia: "Pão Quente",
  municipio: "Belo Horizonte",
  uf: "MG",
  cnaeCodigo: "5611201",
  cnaeDescricao: "Padaria",
  telefone: "31988887777",
  seal: "CONFIRMADO",
  sharedCount: 1,
  decisorNome: "Ana",
  porte: "01",
  email: "ana@padaria.com.br",
  gridScore: 10,
  gridPosition: 1,
  enrichmentStatus: null,
  hasAudit: false,
};

describe("lead query keys", () => {
  it("normalizes CNPJ so grid and ficha share the cache", () => {
    expect(normalizeLeadCnpj("12.345.678/0001-90")).toBe("12345678000190");
    expect(leadQueryKey("12.345.678/0001-90", "s1")).toEqual([
      "lead",
      "12345678000190",
      "s1",
    ]);
    expect(leadPreviewKey(row.cnpj)).toEqual(["lead-preview", "12345678000190"]);
  });
});

describe("lead preview", () => {
  it("copies the grid row fields the ficha can paint immediately", () => {
    expect(gridRowToPreview(row)).toEqual({
      cnpj: "12345678000190",
      razaoSocial: "Padaria Centro Ltda",
      nomeFantasia: "Pão Quente",
      municipio: "Belo Horizonte",
      uf: "MG",
      telefone: "31988887777",
      seal: "CONFIRMADO",
      decisorNome: "Ana",
      cnaeDescricao: "Padaria",
    });
  });

  it("maps an empresas hit", () => {
    const hit: CompanySearchHit = {
      cnpj: "12345678000190",
      razaoSocial: "Padaria Centro Ltda",
      nomeFantasia: null,
      municipio: "Belo Horizonte",
      uf: "MG",
      cnaeCodigo: "5611201",
      cnaeDescricao: "Padaria",
      telefone: null,
      decisorNome: null,
    };
    expect(companyHitToPreview(hit).nomeFantasia).toBeNull();
    expect(companyHitToPreview(hit).seal).toBeNull();
  });
});
