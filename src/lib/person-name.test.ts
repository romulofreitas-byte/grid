import { describe, expect, it } from "vitest";
import { shortPersonName } from "./person-name";

describe("shortPersonName", () => {
  it("keeps the first two given names", () => {
    expect(shortPersonName("JOÃO CARLOS DA SILVA SANTOS")).toBe("João Carlos");
    expect(shortPersonName("ANA PAULA DE SOUZA")).toBe("Ana Paula");
  });

  it("skips particles instead of returning Maria Da", () => {
    expect(shortPersonName("MARIA DA SILVA")).toBe("Maria Silva");
    expect(shortPersonName("JOÃO DOS SANTOS OLIVEIRA")).toBe("João Santos");
  });

  it("returns a single name when that is all there is", () => {
    expect(shortPersonName("MARIA")).toBe("Maria");
    expect(shortPersonName("DA SILVA")).toBe("Silva");
  });

  it("returns null for empty values", () => {
    expect(shortPersonName(null)).toBeNull();
    expect(shortPersonName("   ")).toBeNull();
  });
});
