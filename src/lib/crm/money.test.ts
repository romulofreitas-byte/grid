import { describe, expect, it } from "vitest";
import {
  formatCentsInput,
  maskDealAmountTyping,
  parseBrlToCents,
} from "./money";

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
  it("formats cents for the deal field with R$", () => {
    expect(formatCentsInput(null)).toBe("");
    expect(formatCentsInput(123456)).toBe("R$ 1.234,56");
    expect(formatCentsInput(0)).toBe("R$ 0,00");
  });
});

describe("maskDealAmountTyping", () => {
  it("pads reais with R$ and ,00 as digits arrive", () => {
    expect(maskDealAmountTyping("")).toBe("");
    expect(maskDealAmountTyping("2")).toBe("R$ 2,00");
    expect(maskDealAmountTyping("20")).toBe("R$ 20,00");
    expect(maskDealAmountTyping("20000")).toBe("R$ 20.000,00");
  });

  it("folds extra digits after a padded ,00 into the reais", () => {
    expect(maskDealAmountTyping("R$ 2,00")).toBe("R$ 2,00");
    expect(maskDealAmountTyping("R$ 2,000")).toBe("R$ 20,00");
    expect(maskDealAmountTyping("R$ 20.000,000")).toBe("R$ 200.000,00");
  });

  it("keeps a typed comma so cents can follow", () => {
    expect(maskDealAmountTyping("20000,")).toBe("R$ 20.000,");
    expect(maskDealAmountTyping("R$ 20.000,5")).toBe("R$ 20.000,5");
    expect(maskDealAmountTyping("R$ 20.000,50")).toBe("R$ 20.000,50");
    expect(maskDealAmountTyping("R$ 20.000,500")).toBe("R$ 20.000,50");
  });
});
