import { describe, expect, it } from "vitest";
import {
  canSearchCompanies,
  companyNameTokens,
  companySearchDigits,
  escapeIlike,
  isCompanyCnpjQuery,
  isFullCnpjQuery,
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

  it("detects a full 14-digit CNPJ", () => {
    expect(isFullCnpjQuery("03415812000196")).toBe(true);
    expect(isFullCnpjQuery("03415812")).toBe(false);
  });

  it("builds a translate() fold for SQL", () => {
    expect(sqlFoldAccent("c.razao_social")).toMatch(/^translate\(lower\(c\.razao_social\)/);
  });
});
