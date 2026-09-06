import { describe, expect, it } from "vitest";
import { displayName, headerGivenName } from "./pilot-profile";

describe("headerGivenName", () => {
  it("uses the first word of como_chama", () => {
    expect(
      headerGivenName({ como_chama: "Rômulo", nome: "Rômulo de Belo Horizonte" }),
    ).toBe("Rômulo");
  });

  it("does not put the full legal name in the chip", () => {
    expect(
      headerGivenName({
        como_chama: null,
        nome: "Rômulo de Belo Horizonte",
      }),
    ).toBe("Rômulo");
  });

  it("falls back to Piloto when both are empty", () => {
    expect(headerGivenName({ como_chama: "  ", nome: null })).toBe("Piloto");
  });
});

describe("displayName", () => {
  it("keeps the full calling name for hover and menus", () => {
    expect(
      displayName({ como_chama: "Rômulo", nome: "Rômulo de Belo Horizonte" }),
    ).toBe("Rômulo");
    expect(
      displayName({ como_chama: null, nome: "Rômulo de Belo Horizonte" }),
    ).toBe("Rômulo de Belo Horizonte");
  });
});
