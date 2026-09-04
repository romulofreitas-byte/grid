import { describe, expect, it } from "vitest";
import {
  eachTen,
  formatBrl,
  maskBrlTyping,
  reaisFromBrlMask,
  roundReais,
} from "./money";

describe("maskBrlTyping", () => {
  it("formats whole reais with cents as the person types", () => {
    expect(maskBrlTyping("1")).toBe("R$ 1,00");
    expect(maskBrlTyping("15")).toBe("R$ 15,00");
    expect(maskBrlTyping("1500")).toBe("R$ 1.500,00");
    expect(maskBrlTyping("150000")).toBe("R$ 150.000,00");
  });

  it("lets comma start the cents", () => {
    expect(maskBrlTyping("150000,")).toBe("R$ 150.000,");
    expect(maskBrlTyping("150000,5")).toBe("R$ 150.000,5");
    expect(maskBrlTyping("150000,50")).toBe("R$ 150.000,50");
  });

  it("ignores thousand dots and a currency prefix on paste", () => {
    expect(maskBrlTyping("R$ 150.000,00")).toBe("R$ 150.000,00");
    expect(maskBrlTyping("")).toBe("");
  });
});

describe("reaisFromBrlMask", () => {
  it("reads Brazilian currency back to reais", () => {
    expect(reaisFromBrlMask("R$ 150.000,00")).toBe(150000);
    expect(reaisFromBrlMask("R$ 150.000,50")).toBe(150000.5);
    expect(reaisFromBrlMask("R$ 0,50")).toBe(0.5);
    expect(reaisFromBrlMask("")).toBe(0);
  });
});

describe("formatBrl", () => {
  it("renders stored reais with the currency sign", () => {
    expect(formatBrl(150000)).toMatch(/R\$\s*150\.000,00/);
    expect(formatBrl(0)).toBe("");
  });
});

describe("eachTen", () => {
  it("turns a percent into how many in ten", () => {
    expect(eachTen(20)).toBe("2");
    expect(eachTen(70)).toBe("7");
    expect(eachTen(55)).toBe("5,5");
  });
});

describe("roundReais", () => {
  it("keeps two decimal places", () => {
    expect(roundReais(10.999)).toBe(11);
    expect(roundReais(8.867)).toBe(8.87);
  });
});
