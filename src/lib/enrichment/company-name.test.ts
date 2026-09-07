import { describe, expect, it } from "vitest";
import {
  displayCompanyName,
  titleCaseCompanyName,
  domainSearchQueries,
  domainSearchFallbackQueries,
  domainSearchNationalFallbackQueries,
  searchableCompanyName,
  cidFromMapsUrl,
  companyMapsQuery,
  leadMapsHref,
  mapsListingHref,
  mapsPlaceNameFromUrl,
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

describe("titleCaseCompanyName", () => {
  it("title-cases RF uppercase and keeps legal suffixes", () => {
    expect(titleCaseCompanyName("VIDROBOX DE MONTES CLAROS LTDA")).toBe(
      "Vidrobox de Montes Claros LTDA",
    );
    expect(titleCaseCompanyName("ML VIDROS")).toBe("ML Vidros");
  });

  it("leaves an already mixed fantasia alone", () => {
    expect(titleCaseCompanyName("Marmoraria Carvalho")).toBe("Marmoraria Carvalho");
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

describe("domainSearchNationalFallbackQueries", () => {
  it("quotes fantasia without município or UF", () => {
    expect(
      domainSearchNationalFallbackQueries({
        nomeFantasia: "Lavanderia 60 Minutos",
        razaoSocial: "LAVANDERIA 60 MINUTOS BH LTDA",
      }),
    ).toEqual(['"Lavanderia 60 Minutos"', "Lavanderia 60 Minutos site"]);
  });

  it("falls back to stripped razão when there is no fantasia", () => {
    expect(
      domainSearchNationalFallbackQueries({
        nomeFantasia: null,
        razaoSocial: "Clinica Sol Ltda",
      }),
    ).toEqual(['"Clinica Sol"', "Clinica Sol site"]);
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

  it("deep-links a city candidate even when identity did not match", () => {
    expect(
      leadMapsHref(query, {
        matched: false,
        status: "candidate",
        cid: "999",
      }),
    ).toBe("https://www.google.com/maps?cid=999");
  });
});

describe("mapsListingHref", () => {
  it("opens a stored Maps search when the listing is still a miss", () => {
    const href = mapsListingHref({
      matched: false,
      status: "none",
      url: "https://www.google.com/maps/search/?api=1&query=%22Armazem%22",
    });
    expect(href).toContain("google.com/maps/search");
  });

  it("stays empty when a miss has no URL yet", () => {
    expect(
      mapsListingHref({ matched: false, status: "none", url: "" }),
    ).toBeNull();
  });
});

describe("cidFromMapsUrl", () => {
  it("reads cid from a Maps listing URL", () => {
    expect(cidFromMapsUrl("https://www.google.com/maps?cid=12345")).toBe("12345");
    expect(cidFromMapsUrl("maps.google.com/?cid=99")).toBe("99");
    expect(cidFromMapsUrl("https://maps.app.goo.gl/abc")).toBeNull();
  });

  it("reads cid from a /place/ feature id", () => {
    const href =
      "https://www.google.com/maps/place/Drimafer+M%C3%A1quinas+e+Equipamentos/@-23.6940753,-46.6088771,17z/data=!3m1!4b1!4m6!3m5!1s0x94ce455536cfb6c9:0xce7f0a7f9addee96!8m2!3d-23.6940753!4d-46.6088771";
    expect(cidFromMapsUrl(href)).toBe(BigInt("0xce7f0a7f9addee96").toString(10));
  });
});

describe("mapsPlaceNameFromUrl", () => {
  it("reads the trading name from a /place/ path", () => {
    expect(
      mapsPlaceNameFromUrl(
        "https://www.google.com/maps/place/Drimafer+M%C3%A1quinas+e+Equipamentos/@-23.6940753,-46.6088771,17z",
      ),
    ).toBe("Drimafer Máquinas e Equipamentos");
  });
});
