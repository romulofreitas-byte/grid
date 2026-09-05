import { describe, expect, it } from "vitest";
import { CONTA_NAV, isContaNavActive } from "./conta-nav";

describe("conta nav", () => {
  it("lists the admin fronts and keeps Equipe as soon", () => {
    expect(CONTA_NAV.map((item) => item.href)).toEqual([
      "/conta",
      "/conta/perfil",
      "/conta/acesso",
      "/conta/plano",
      "/conta/conexoes",
      "/conta/ajuda",
      "/conta/equipe",
    ]);
    expect(CONTA_NAV.find((item) => item.href === "/conta/equipe")?.soon).toBe(true);
    expect(CONTA_NAV.filter((item) => item.soon)).toHaveLength(1);
  });

  it("marks Resumo only on the hub root", () => {
    expect(isContaNavActive("/conta", "/conta")).toBe(true);
    expect(isContaNavActive("/conta", "/conta/perfil")).toBe(false);
    expect(isContaNavActive("/conta/perfil", "/conta/perfil")).toBe(true);
    expect(isContaNavActive("/conta/plano", "/conta")).toBe(false);
  });
});
