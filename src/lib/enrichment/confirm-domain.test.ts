import { describe, expect, it } from "vitest";
import { confirmDomainOwnership, distinctiveTokens } from "./confirm-domain";

describe("confirmDomainOwnership", () => {
  it("accepts a page that contains the CNPJ digits", () => {
    expect(
      confirmDomainOwnership({
        html: "<p>CNPJ 12.345.678/0001-90</p>",
        cnpj: "12345678000190",
        razaoSocial: "Metalurgica XYZ LTDA",
        nomeFantasia: "XYZ",
        municipio: "Belo Horizonte",
      }),
    ).toBe(true);
  });

  it("accepts two distinctive tokens from the legal name", () => {
    expect(
      confirmDomainOwnership({
        html: "Bem-vindo à Metalurgica XYZ, especialistas em aço",
        cnpj: "00000000000000",
        razaoSocial: "Metalurgica XYZ LTDA",
        nomeFantasia: null,
        municipio: "Contagem",
      }),
    ).toBe(true);
  });

  it("rejects a directory page that does not mention the company", () => {
    expect(
      confirmDomainOwnership({
        html: "Lista de empresas de Contagem — veja o ranking",
        cnpj: "12345678000190",
        razaoSocial: "Metalurgica XYZ LTDA",
        nomeFantasia: "Forja Norte",
        municipio: "Contagem",
      }),
    ).toBe(false);
  });
});

describe("distinctiveTokens", () => {
  it("drops corporate stopwords and the city name", () => {
    const tokens = distinctiveTokens(
      "Comercio Silva LTDA",
      null,
      "Silva",
    );
    expect(tokens).not.toContain("ltda");
    expect(tokens).not.toContain("comercio");
  });
});
