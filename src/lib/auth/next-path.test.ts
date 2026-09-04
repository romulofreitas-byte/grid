import { describe, expect, it } from "vitest";
import { isPaymentNext, safeInternalPath } from "./next-path";

describe("safeInternalPath", () => {
  it("allows internal paths with query", () => {
    expect(safeInternalPath("/pagar?sku=piloto")).toBe("/pagar?sku=piloto");
    expect(safeInternalPath("/box")).toBe("/box");
    expect(safeInternalPath("%2Fpagar%3Fsku%3Dpiloto")).toBe(
      "/pagar?sku=piloto",
    );
  });

  it("does not decode an already-path next that contains encoded from", () => {
    expect(
      safeInternalPath("/pagar?sku=piloto&from=%2Flead%2F1%3FsearchId%3Dabc"),
    ).toBe("/pagar?sku=piloto&from=%2Flead%2F1%3FsearchId%3Dabc");
  });

  it("rejects open redirects", () => {
    expect(safeInternalPath("https://evil.example/phish")).toBe("/painel");
    expect(safeInternalPath("//evil.example")).toBe("/painel");
    expect(safeInternalPath("/\\evil")).toBe("/painel");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/painel");
  });

  it("falls back on empty or login loops", () => {
    expect(safeInternalPath(null)).toBe("/painel");
    expect(safeInternalPath("/entrar?next=/pagar")).toBe("/painel");
    expect(safeInternalPath("/entrar?go=1")).toBe("/entrar?go=1");
    expect(safeInternalPath("/entrar?definir=1")).toBe("/entrar?definir=1");
  });
});

describe("isPaymentNext", () => {
  it("detects checkout destinations", () => {
    expect(isPaymentNext("/pagar?sku=piloto")).toBe(true);
    expect(isPaymentNext("/planos")).toBe(true);
    expect(isPaymentNext("/box")).toBe(false);
  });
});
