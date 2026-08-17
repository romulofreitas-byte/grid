import { describe, expect, it } from "vitest";
import {
  canSearchCompanies,
  companySearchDigits,
  escapeIlike,
  isCompanyCnpjQuery,
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
});
