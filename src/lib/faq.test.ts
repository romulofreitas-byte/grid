import { describe, expect, it } from "vitest";
import { FAQ_ITEMS, faqGrouped, filterFaq } from "./faq";

describe("filterFaq", () => {
  it("returns all items on empty query", () => {
    expect(filterFaq(FAQ_ITEMS, "  ")).toHaveLength(FAQ_ITEMS.length);
  });

  it("matches without accents", () => {
    const hits = filterFaq(FAQ_ITEMS, "credito");
    expect(hits.some((item) => item.id === "quando-credito")).toBe(true);
    expect(hits.some((item) => item.id === "plano-zera")).toBe(true);
  });

  it("matches saved vs unsaved lists", () => {
    const hits = filterFaq(FAQ_ITEMS, "nao salvas");
    expect(hits.some((item) => item.id === "listas-salvas")).toBe(true);
    const item = FAQ_ITEMS.find((entry) => entry.id === "listas-salvas");
    expect(item?.answer).toMatch(/no máximo 3/);
  });
});

describe("crm-nativo FAQ", () => {
  it("says the pista starts on Plano Piloto", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "crm-nativo");
    expect(item?.answer).toMatch(/Plano Piloto/);
  });
});

describe("conexoes FAQ", () => {
  it("says GRID dials with VoIP and falls back to the device phone", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "conexoes");
    expect(item?.answer).toMatch(/GRID disca/);
    expect(item?.answer).toMatch(/telefone do aparelho/);
  });
});

describe("maps FAQ", () => {
  it("says qualification searches Maps by name and city without storing Places content", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "maps");
    expect(item?.answer).toMatch(/nome e pela cidade/i);
    expect(item?.answer).toMatch(/não grava telefone/i);
    expect(item?.answer).toMatch(/não usa a API do Google Places/i);
  });
});

describe("acesso FAQ", () => {
  it("describes password signup and recovery for old magic-link users", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "acesso");
    expect(item?.answer).toMatch(/e-mail e senha/i);
    expect(item?.answer).toMatch(/Esqueci a senha/);
  });
});

describe("membro-plataforma FAQ", () => {
  it("publishes PILOTO for active platform subscribers", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "membro-plataforma");
    expect(item?.answer).toMatch(/PILOTO/);
    expect(item?.answer).toMatch(/assinantes ativos da Plataforma/);
    expect(item?.links).toEqual([
      { href: "/pagar?sku=membro_plataforma", label: "Ativar com cupom" },
    ]);
  });
});

describe("faqGrouped", () => {
  it("keeps category order and drops empty groups", () => {
    const selos = FAQ_ITEMS.filter((item) => item.id === "selos");
    expect(faqGrouped(selos)).toEqual([
      { category: "Lista e contato", items: selos },
    ]);
  });
});
