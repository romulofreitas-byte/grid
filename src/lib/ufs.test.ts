import { describe, expect, it } from "vitest";
import { BRAZIL_UF_LIST, isBrazilUf } from "./ufs";

describe("isBrazilUf", () => {
  it("accepts the 27 codes case-insensitively", () => {
    expect(BRAZIL_UF_LIST).toHaveLength(27);
    expect(isBrazilUf("mg")).toBe(true);
    expect(isBrazilUf("PR")).toBe(true);
    expect(isBrazilUf("XX")).toBe(false);
    expect(isBrazilUf("Belo Horizonte")).toBe(false);
  });
});
