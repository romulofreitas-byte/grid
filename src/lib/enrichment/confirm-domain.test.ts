import { describe, expect, it } from "vitest";
import {
  confirmDomainOwnership,
  distinctiveTokens,
  fantasiaTokens,
  presenceBrandTokens,
} from "./confirm-domain";

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

  it("accepts a strong brand token from the legal name", () => {
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

  it("accepts a single strong fantasia token (Genesis-like)", () => {
    expect(
      confirmDomainOwnership({
        html: "<h1>Colégio Genesis</h1><p>Educação infantil em BH</p>",
        cnpj: "00000000000000",
        razaoSocial: "Genesis Sociedade de Ensino Ltda",
        nomeFantasia: "Genesis",
        municipio: "Belo Horizonte",
      }),
    ).toBe(true);
  });

  it("does not confirm portal pages with only weak trade tokens (auto/pecas)", () => {
    expect(
      confirmDomainOwnership({
        html: "<h1>Portal UAI</h1><p>Notícias de auto e peças em Minas</p>",
        cnpj: "00000000000000",
        razaoSocial: "AUTO PECAS STELA LTDA",
        nomeFantasia: "AUTO PECAS SAO LUIZ",
        municipio: "Descoberto",
      }),
    ).toBe(false);
  });

  it("does not treat sociedade/ensino alone as ownership", () => {
    expect(
      confirmDomainOwnership({
        html: "<p>Sociedade de Ensino — portal genérico</p>",
        cnpj: "00000000000000",
        razaoSocial: "Genesis Sociedade de Ensino Ltda",
        nomeFantasia: null,
        municipio: "Belo Horizonte",
      }),
    ).toBe(false);
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

  it("drops sociedade from razão social tokens", () => {
    const tokens = distinctiveTokens(
      "Genesis Sociedade de Ensino Ltda",
      null,
      "Belo Horizonte",
    );
    expect(tokens).not.toContain("sociedade");
    expect(tokens).toContain("genesis");
    expect(tokens).toContain("ensino");
  });
});

describe("fantasiaTokens", () => {
  it("returns only fantasia tokens", () => {
    expect(fantasiaTokens("Colégio Genesis", "Belo Horizonte")).toEqual([
      "colegio",
      "genesis",
    ]);
  });
});

describe("presenceBrandTokens", () => {
  it("drops surnames and generic trade nouns", () => {
    expect(
      presenceBrandTokens(
        "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
        "DISTRIBUIDORA SILVA",
        "Contagem",
      ),
    ).toEqual([]);
  });

  it("keeps distinctive brand tokens like Genesis", () => {
    expect(
      presenceBrandTokens(
        "Genesis Sociedade de Ensino Ltda",
        "Genesis",
        "Belo Horizonte",
      ),
    ).toContain("genesis");
  });
});
