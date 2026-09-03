import { describe, expect, it } from "vitest";
import {
  canSearchCompanies,
  CNPJ_EXAMPLE_DIGITS,
  CNPJ_EXAMPLE_FORMATTED,
  CNPJ_EXAMPLE_ROOT,
  COMPANY_PREFIX_ENOUGH,
  companyIlikePrefixPattern,
  companyIlikeTokens,
  companyNameHasTokenPrefix,
  companyNameMatchesFields,
  companyNameTokens,
  companyPrefixWordRegex,
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

  it("drops legal suffixes so Vale S.A. matches VALE S.A.", () => {
    expect(companyIlikeTokens("Vale S.A.")).toEqual(["Vale"]);
    expect(companyIlikeTokens("Vale SA")).toEqual(["Vale"]);
    expect(companyIlikePrefixPattern("Vale S.A.")).toBe("Vale%");
    expect(companyNameTokens("VALE S.A.")).toEqual(["vale"]);
    expect(
      companyNameMatchesFields("Vale S.A.", "VALE S.A.", null),
    ).toBe(true);
    expect(
      companyNameMatchesFields("Vale SA", "VALE S.A.", "VALE"),
    ).toBe(true);
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

  it("matches fantasia even when razão social is a different name", () => {
    expect(
      companyNameMatchesFields(
        "produtos marina",
        "ITAUNA QUIMICA LTDA",
        "PRODUTOS MARINA",
      ),
    ).toBe(true);
    expect(
      companyNameMatchesFields(
        "produtos marina",
        "ITAUNA QUIMICA LTDA",
        null,
      ),
    ).toBe(false);
    expect(
      companyNameMatchesFields(
        "itauna quimica",
        "ITAUNA QUIMICA LTDA",
        "PRODUTOS MARINA",
      ),
    ).toBe(true);
  });

  it("builds a prefix pattern from name tokens", () => {
    expect(companyIlikePrefixPattern("produtos marina")).toBe("produtos marina%");
    expect(companyIlikePrefixPattern("a b")).toBeNull();
    expect(companyPrefixWordRegex("Vale S.A.")).toBe("^Vale([^[:alpha:]]|$)");
    expect(companyNameHasTokenPrefix("VALE S.A.", "Vale S.A.")).toBe(true);
    expect(companyNameHasTokenPrefix("VALENTE STUDIO", "Vale S.A.")).toBe(false);
    expect(companyNameHasTokenPrefix("VALE DO AGRESTE", "Vale")).toBe(true);
  });

  it("keeps CNPJ format examples consistent with digit counts", () => {
    expect(companySearchDigits(CNPJ_EXAMPLE_FORMATTED)).toBe(CNPJ_EXAMPLE_DIGITS);
    expect(CNPJ_EXAMPLE_DIGITS).toHaveLength(14);
    expect(CNPJ_EXAMPLE_ROOT).toHaveLength(8);
    expect(isCompanyCnpjQuery(CNPJ_EXAMPLE_FORMATTED)).toBe(true);
    expect(isCompanyCnpjQuery(CNPJ_EXAMPLE_DIGITS)).toBe(true);
    expect(isCompanyCnpjQuery(CNPJ_EXAMPLE_ROOT)).toBe(true);
  });
});
