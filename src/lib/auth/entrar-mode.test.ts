import { describe, expect, it } from "vitest";
import { modeFromParams } from "./entrar-mode";

describe("modeFromParams", () => {
  it("defaults to login", () => {
    expect(modeFromParams(new URLSearchParams())).toBe("login");
    expect(modeFromParams(new URLSearchParams("modo=entrar"))).toBe("login");
  });

  it("opens signup from modo=cadastro", () => {
    expect(modeFromParams(new URLSearchParams("modo=cadastro"))).toBe("signup");
  });

  it("keeps recover and definir", () => {
    expect(modeFromParams(new URLSearchParams("modo=recuperar"))).toBe(
      "recover",
    );
    expect(modeFromParams(new URLSearchParams("definir=1"))).toBe("definir");
    expect(
      modeFromParams(new URLSearchParams("definir=1&modo=cadastro")),
    ).toBe("definir");
  });
});
