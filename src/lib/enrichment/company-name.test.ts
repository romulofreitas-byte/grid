import { describe, expect, it } from "vitest";
import {
  displayCompanyName,
  domainSearchQueries,
  domainSearchFallbackQueries,
  searchableCompanyName,
  companyMapsQuery,
  leadMapsHref,
} from "./company-name";

describe("displayCompanyName", () => {
  it("prefers nome fantasia", () => {
    expect(displayCompanyName("Marmoraria Carvalho", "MARMORARIA CARVALHO LTDA")).toBe(
      "Marmoraria Carvalho",
    );
  });

  it("falls back to razão social", () => {
    expect(displayCompanyName(null, "MARMORARIA CARVALHO LTDA")).toBe(
      "MARMORARIA CARVALHO LTDA",
    );
  });
});

describe("searchableCompanyName", () => {
  it("uses fantasia when present", () => {
    expect(searchableCompanyName("Clinica Sol", "Clinica Sol Ltda")).toBe("Clinica Sol");
  });

  it("strips legal suffixes from razão social", () => {
    expect(searchableCompanyName(null, "Clinica Sol Ltda")).toBe("Clinica Sol");
  });
});

describe("domainSearchQueries", () => {
  it("quotes fantasia first, then razão without the legal suffix when they differ", () => {
    expect(
      domainSearchQueries({
        nomeFantasia: "Carvalho Pedras",
        razaoSocial: "MARMORARIA CARVALHO LTDA",
        municipio: "Itauna",
        uf: "MG",
      }),
    ).toEqual([
      '"Carvalho Pedras" Itauna MG',
      '"MARMORARIA CARVALHO" Itauna MG',
    ]);
  });

  it("skips a duplicate when fantasia equals the stripped razão", () => {
    expect(
      domainSearchQueries({
        nomeFantasia: "Clinica Sol",
        razaoSocial: "Clinica Sol Ltda",
        municipio: "Belo Horizonte",
        uf: "MG",
      }),
    ).toEqual(['"Clinica Sol" Belo Horizonte MG']);
  });
});

describe("domainSearchFallbackQueries", () => {
  it("adds an unquoted site query so directories do not bury the real host", () => {
    expect(
      domainSearchFallbackQueries({
        nomeFantasia: "COLEGIO SANTA DOROTEIA",
        razaoSocial: "CONGREGACAO DE SANTA DOROTEIA DO BRASIL - SUL",
        municipio: "Belo Horizonte",
        uf: "MG",
      }),
    ).toEqual([
      "COLEGIO SANTA DOROTEIA Belo Horizonte MG site",
      "COLEGIO SANTA DOROTEIA Belo Horizonte MG",
      "CONGREGACAO DE SANTA DOROTEIA DO BRASIL - SUL Belo Horizonte MG site",
    ]);
  });
});

describe("companyMapsQuery", () => {
  it("quotes the name so Maps does not snap to a nearby POI", () => {
    expect(
      companyMapsQuery({
        nomeFantasia: "Marmoraria Carvalho",
        razaoSocial: "MARMORARIA CARVALHO LTDA",
        municipio: "Itauna",
        uf: "MG",
        logradouro: "Rua das Palmeiras",
        numero: "120",
      }),
    ).toBe('"Marmoraria Carvalho" Rua das Palmeiras 120 Itauna MG');
  });
});

describe("leadMapsHref", () => {
  const query = {
    nomeFantasia: "GRUPO ATOS",
    razaoSocial: "GRUPO ATOS LTDA",
    municipio: "Belo Horizonte",
    uf: "MG",
    logradouro: "Rua da Bahia",
    numero: "2741",
  };

  it("deep-links to the matched listing cid", () => {
    expect(
      leadMapsHref(query, { matched: true, cid: "12345", url: "https://grupoatos.com" }),
    ).toBe("https://www.google.com/maps?cid=12345");
  });

  it("falls back to a quoted search when Maps did not match", () => {
    const href = leadMapsHref(query, { matched: false });
    expect(href).toContain("google.com/maps/search");
    expect(decodeURIComponent(href)).toContain('"GRUPO ATOS"');
  });
});
