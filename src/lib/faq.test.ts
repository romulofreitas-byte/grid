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
    expect(item?.answer).toMatch(/Excluir uma lista não apaga o CRM/);
    expect(item?.answer).toMatch(/Transfira os negócios|transfere os negócios/);
    expect(item?.answer).toMatch(/sem criar uma lista de um lead/);
  });
});

describe("qualificar FAQ", () => {
  it("says Treino livre includes 25 qualifications", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "qualificar");
    expect(item?.answer).toMatch(/25 por mês/);
    expect(item?.answer).toMatch(/Plano Piloto/);
    expect(item?.answer).toMatch(/sem criar uma lista de um lead/);
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
    expect(item?.answer).toMatch(/candidato/i);
    expect(item?.answer).toMatch(/Não possui/i);
    expect(item?.answer).toMatch(/fechado/i);
  });
});

describe("capacete FAQ", () => {
  it("describes a short identity setup without generating a list", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "capacete");
    expect(item?.answer).toMatch(/como te chama/);
    expect(item?.answer).toMatch(/cargo/);
    expect(item?.answer).toMatch(/nova lista/);
    expect(item?.answer).toMatch(/foto é opcional/);
    expect(item?.answer).toMatch(/documento/);
    expect(item?.answer).not.toMatch(/promessa/);
    expect(item?.answer).not.toMatch(/primeira lista/);
    expect(item?.answer.toLowerCase()).not.toMatch(/já te conhece/);
    expect(item?.links).toEqual([{ href: "/setup", label: "Começar" }]);
  });
});

describe("rever-tour FAQ", () => {
  it("points replay to Conta Ajuda instead of the Painel", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "rever-tour");
    expect(item?.answer.toLowerCase()).toMatch(/uma vez/);
    expect(item?.answer).toMatch(/Conta/);
    expect(item?.answer).toMatch(/Ajuda/);
    expect(item?.links).toEqual([{ href: "/conta/ajuda", label: "Abrir ajuda" }]);
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

describe("piloto-pro FAQ", () => {
  it("sends Automações to Piloto Pro checkout", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "piloto-pro");
    expect(item?.answer).toMatch(/Piloto Pro/);
    expect(item?.answer).not.toMatch(/lista de espera|ainda não está à venda/i);
    expect(item?.links?.some((link) => link.href === "/pagar?sku=piloto_pro")).toBe(
      true,
    );
  });
});

describe("marcar-ganho FAQ", () => {
  it("talks about the company as a new client", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "marcar-ganho");
    expect(item?.answer).toMatch(/novo cliente/);
    expect(item?.answer).toMatch(/onboarding/);
  });
});

describe("trial-acabou FAQ", () => {
  it("says packs do not reopen CRM", () => {
    const item = FAQ_ITEMS.find((entry) => entry.id === "trial-acabou");
    expect(item?.answer).toMatch(/não reabre/);
    expect(item?.links).toEqual([{ href: "/planos", label: "Ver planos" }]);
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
