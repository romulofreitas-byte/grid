import { describe, expect, it } from "vitest";
import { isOpsInternalTester } from "./exclude";

describe("ops internal testers", () => {
  it("drops the print accounts by email", () => {
    expect(isOpsInternalTester({ email: "MundoPodium@gmail.com" })).toBe(true);
    expect(isOpsInternalTester({ email: "administracao@combustivelmv.com" })).toBe(
      true,
    );
    expect(isOpsInternalTester({ email: "romulo.freitas@combustivelmv.com" })).toBe(
      true,
    );
  });

  it("drops the no-email Rômulo Freitas row by name", () => {
    expect(isOpsInternalTester({ nome: "Rômulo Freitas", email: null })).toBe(true);
  });

  it("keeps a real piloto", () => {
    expect(
      isOpsInternalTester({
        email: "maria@oficina.com",
        nome: "Maria",
      }),
    ).toBe(false);
  });
});
