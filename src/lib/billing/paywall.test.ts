import { describe, expect, it, vi } from "vitest";
import {
  BillingGateError,
  blockQualifyIfFree,
  insufficientCreditsPayload,
  isBillingGateError,
  parseBillingGate,
  paywallCopy,
  planRequiredPayload,
  PLANOS_URL,
  RECARGA_URL,
  throwIfBillingGate,
} from "./paywall";

describe("parseBillingGate", () => {
  it("reads plan_required from code", () => {
    expect(
      parseBillingGate(403, planRequiredPayload("Qualificação não está no Treino livre. Escolha um plano.")),
    ).toEqual({ kind: "plan", upgradeUrl: PLANOS_URL });
  });

  it("reads insufficient_credits from code", () => {
    expect(parseBillingGate(402, insufficientCreditsPayload(12, 3))).toEqual({
      kind: "credits",
      needed: 12,
      available: 3,
      upgradeUrl: PLANOS_URL,
    });
  });

  it("falls back to Treino livre copy on 403 without code", () => {
    expect(
      parseBillingGate(403, {
        error: "Qualificação não está no Treino livre. Escolha um plano.",
        upgradeUrl: "/planos",
      }),
    ).toEqual({ kind: "plan", upgradeUrl: "/planos" });
  });

  it("treats 402 without code as credits", () => {
    expect(
      parseBillingGate(402, {
        error: "Créditos insuficientes",
        needed: 4,
        available: 1,
        upgradeUrl: "/planos",
      }),
    ).toEqual({
      kind: "credits",
      needed: 4,
      available: 1,
      upgradeUrl: "/planos",
    });
  });

  it("ignores unrelated 403", () => {
    expect(parseBillingGate(403, { error: "Não autenticado" })).toBeNull();
  });

  it("ignores generic 400", () => {
    expect(parseBillingGate(400, { error: "Payload inválido" })).toBeNull();
  });
});

describe("paywallCopy", () => {
  it("points plan qualify to /planos", () => {
    const copy = paywallCopy({ kind: "plan", feature: "qualify" });
    expect(copy.title).toMatch(/Plano Piloto/);
    expect(copy.primary).toEqual({ href: PLANOS_URL, label: "Ver planos" });
    expect(copy.secondary).toEqual({ action: "close", label: "Fechar" });
  });

  it("points credits to recarga with counts", () => {
    const copy = paywallCopy({
      kind: "credits",
      feature: "export",
      needed: 8,
      available: 2,
    });
    expect(copy.body).toContain("8 créditos");
    expect(copy.body).toContain("2 disponíveis");
    expect(copy.primary).toEqual({ href: RECARGA_URL, label: "Recarregar" });
    expect(copy.secondary).toEqual({ href: PLANOS_URL, label: "Ver planos" });
  });
});

describe("throwIfBillingGate", () => {
  it("opens the paywall and throws BillingGateError", () => {
    const open = vi.fn();
    expect(() =>
      throwIfBillingGate(402, insufficientCreditsPayload(2, 0), open, "qualify"),
    ).toThrow(BillingGateError);
    expect(open).toHaveBeenCalledWith({
      kind: "credits",
      feature: "qualify",
      needed: 2,
      available: 0,
    });
  });

  it("does nothing when the response is not a gate", () => {
    const open = vi.fn();
    throwIfBillingGate(400, { error: "Payload inválido" }, open, "export");
    expect(open).not.toHaveBeenCalled();
  });
});

describe("blockQualifyIfFree", () => {
  it("blocks only when enrich is explicitly disallowed", () => {
    const open = vi.fn();
    expect(blockQualifyIfFree(false, open)).toBe(true);
    expect(open).toHaveBeenCalledWith({ kind: "plan", feature: "qualify" });
    expect(blockQualifyIfFree(true, open)).toBe(false);
    expect(blockQualifyIfFree(undefined, open)).toBe(false);
  });
});

describe("isBillingGateError", () => {
  it("recognizes the named error", () => {
    const err = new BillingGateError({ kind: "plan", upgradeUrl: PLANOS_URL });
    expect(isBillingGateError(err)).toBe(true);
    expect(isBillingGateError(new Error("nope"))).toBe(false);
  });
});
