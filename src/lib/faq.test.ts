import { describe, expect, it } from "vitest";
import { FAQ_ITEMS, faqGrouped, filterFaq } from "./faq";

describe("filterFaq", () => {
  it("returns all items on empty query", () => {
    expect(filterFaq(FAQ_ITEMS, "  ")).toHaveLength(FAQ_ITEMS.length);
  });

  it("matches without accents", () => {
    const hits = filterFaq(FAQ_ITEMS, "credito");
    expect(hits.some((item) => item.id === "quando-credito")).toBe(true);
  });

  it("matches saved vs unsaved lists", () => {
    const hits = filterFaq(FAQ_ITEMS, "nao salvas");
    expect(hits.some((item) => item.id === "listas-salvas")).toBe(true);
  });
});

describe("conexoes FAQ", () => {
  it("says GRID dials with VoIP and falls back to the device phone", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "conexoes");
    expect(item?.answer).toMatch(/GRID disca/);
    expect(item?.answer).toMatch(/telefone do aparelho/);
  });
});

describe("acesso FAQ", () => {
  it("describes password signup and recovery for old magic-link users", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "acesso");
    expect(item?.answer).toMatch(/e-mail e senha/i);
    expect(item?.answer).toMatch(/Esqueci a senha/);
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
