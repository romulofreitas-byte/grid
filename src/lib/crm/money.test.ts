import { describe, expect, it } from "vitest";
import { formatCentsInput, parseBrlToCents } from "./money";

describe("parseBrlToCents", () => {
  it("parses Brazilian grouping and decimal comma", () => {
    expect(parseBrlToCents("1.234,56")).toBe(123456);
    expect(parseBrlToCents("R$ 1.234,56")).toBe(123456);
    expect(parseBrlToCents("1234,5")).toBe(123450);
  });

  it("parses dotted decimals and whole reais", () => {
    expect(parseBrlToCents("1234.56")).toBe(123456);
    expect(parseBrlToCents("1500")).toBe(150000);
    expect(parseBrlToCents("1.500")).toBe(150000);
  });

  it("treats empty as null and rejects negatives or overflow", () => {
    expect(parseBrlToCents("")).toBeNull();
    expect(parseBrlToCents("   ")).toBeNull();
    expect(parseBrlToCents("-10")).toBeNull();
    expect(parseBrlToCents("99999999999")).toBeNull();
  });
});

describe("formatCentsInput", () => {
  it("formats cents for the deal field", () => {
    expect(formatCentsInput(null)).toBe("");
    expect(formatCentsInput(123456)).toBe("1.234,56");
  });
});
