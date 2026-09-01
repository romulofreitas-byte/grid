import { describe, expect, it } from "vitest";
import {
  displayCompanyName,
  domainSearchQueries,
  searchableCompanyName,
  companyMapsQuery,
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

describe("companyMapsQuery", () => {
  it("includes street and number so the Maps button lands closer", () => {
    expect(
      companyMapsQuery({
        nomeFantasia: "Marmoraria Carvalho",
        razaoSocial: "MARMORARIA CARVALHO LTDA",
        municipio: "Itauna",
        uf: "MG",
        logradouro: "Rua das Palmeiras",
        numero: "120",
      }),
    ).toBe("Marmoraria Carvalho Rua das Palmeiras 120 Itauna MG");
  });
});
