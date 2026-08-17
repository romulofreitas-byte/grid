import { describe, expect, it } from "vitest";
import { normalizePhoneBR, phonesMatch, sameNumberBR } from "./phone";

describe("normalizePhoneBR", () => {
  it("parses mobile 11 digits", () => {
    const n = normalizePhoneBR("31999998888");
    expect(n?.tipo).toBe("movel");
    expect(n?.ddd).toBe("31");
    expect(n?.e164).toBe("+5531999998888");
    expect(n?.display).toBe("(31) 99999-8888");
  });

  it("strips country code 55", () => {
    const n = normalizePhoneBR("+55 11 98888-7777");
    expect(n?.e164).toBe("+5511988887777");
    expect(n?.tipo).toBe("movel");
  });

  it("classifies landline 10 digits (first digit 2-5)", () => {
    const n = normalizePhoneBR("3133334444");
    expect(n?.tipo).toBe("fixo");
    expect(n?.display).toBe("(31) 3333-4444");
  });

  it("uses fallback DDD for 8-digit local", () => {
    const n = normalizePhoneBR("33334444", "31");
    expect(n?.e164).toBe("+553133334444");
    expect(n?.ddd).toBe("31");
  });

  it("rejects nonexistent DDD", () => {
    expect(normalizePhoneBR("0012345678")).toBeNull();
  });

  it("rejects repeating digits", () => {
    expect(normalizePhoneBR("3111111111")).toBeNull();
  });

  it("marks 0800 as especial", () => {
    const n = normalizePhoneBR("08001234567");
    expect(n?.tipo).toBe("especial");
    expect(n?.ddd).toBeNull();
  });
});

describe("ninth-digit tolerance", () => {
  it("treats 3199998888 as the same line as 31999998888", () => {
    const a = normalizePhoneBR("3199998888");
    const b = normalizePhoneBR("31999998888");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(sameNumberBR(a!, b!)).toBe(true);
    expect(phonesMatch("3199998888", "31999998888")).toBe(true);
  });

  it("does not match different locals", () => {
    expect(phonesMatch("3133334444", "3133335555")).toBe(false);
  });
});
