import { describe, expect, it } from "vitest";
import { isValidEmail, MIN_PASSWORD_LENGTH, validatePassword } from "./password";

describe("validatePassword", () => {
  it("rejects short or missing passwords", () => {
    expect(validatePassword(undefined)).toMatch(/pelo menos 8/);
    expect(validatePassword("1234567")).toMatch(/pelo menos 8/);
    expect(validatePassword("")).toMatch(/pelo menos 8/);
  });

  it(`accepts ${MIN_PASSWORD_LENGTH} or more characters`, () => {
    expect(validatePassword("12345678")).toBeNull();
    expect(validatePassword("senha-boa-aqui")).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("accepts simple emails", () => {
    expect(isValidEmail("piloto@mundopodium.com.br")).toBe(true);
    expect(isValidEmail("  a@b.co  ")).toBe(true);
  });

  it("rejects incomplete values", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("piloto")).toBe(false);
    expect(isValidEmail("piloto@")).toBe(false);
  });
});
