import { describe, expect, it } from "vitest";
import {
  canSearchCompanies,
  COMPANY_PREFIX_ENOUGH,
  companyIlikeTokens,
  companyNameTokens,
  companySearchDigits,
  escapeIlike,
  isCompanyCnpjQuery,
  isFullCnpjQuery,
  mergeCompanyNameWaves,
  sqlFoldAccent,
} from "./company-search";

describe("company search helpers", () => {
  it("detects CNPJ queries with punctuation", () => {
    expect(isCompanyCnpjQuery("12.345.678/0001-90")).toBe(true);
    expect(isCompanyCnpjQuery("12345678")).toBe(true);
    expect(isCompanyCnpjQuery("1234567")).toBe(false);
    expect(companySearchDigits("12.345.678/0001-90")).toBe("12345678000190");
  });

  it("requires 3 letters for name search", () => {
    expect(canSearchCompanies("pa")).toBe(false);
    expect(canSearchCompanies("pada")).toBe(true);
    expect(canSearchCompanies("  ab ")).toBe(false);
    expect(canSearchCompanies("12.345.678")).toBe(true);
  });

  it("escapes ILIKE wildcards", () => {
    expect(escapeIlike("100% legal_")).toBe("100\\% legal\\_");
    expect(escapeIlike("a\\b")).toBe("a\\\\b");
  });

  it("folds accents and drops short tokens", () => {
    expect(companyNameTokens("ÁGUA MINERAL SERRA GRANDE")).toEqual([
      "agua",
      "mineral",
      "serra",
      "grande",
    ]);
    expect(companyNameTokens("A B CD")).toEqual(["cd"]);
  });

  it("keeps accents on ILIKE tokens and skips the contain wave after a prefix hit", () => {
    expect(companyIlikeTokens("Clínica Estética")).toEqual([
      "Clínica",
      "Estética",
    ]);
    expect(COMPANY_PREFIX_ENOUGH).toBe(1);
    expect(
      mergeCompanyNameWaves(
        [{ cnpj: "1" }],
        [{ cnpj: "2" }],
        20,
      ),
    ).toEqual([{ cnpj: "1" }]);
    expect(
      mergeCompanyNameWaves(
        [],
        [{ cnpj: "2" }, { cnpj: "3" }],
        20,
      ),
    ).toEqual([{ cnpj: "2" }, { cnpj: "3" }]);
  });

  it("detects a full 14-digit CNPJ", () => {
    expect(isFullCnpjQuery("03415812000196")).toBe(true);
    expect(isFullCnpjQuery("03415812")).toBe(false);
  });

  it("builds a translate() fold for SQL", () => {
    expect(sqlFoldAccent("c.razao_social")).toMatch(/^translate\(lower\(c\.razao_social\)/);
  });
});
