import { describe, expect, it } from "vitest";
import { gmbListingCorroborated } from "@/lib/types";
import { presenceBrandTokens } from "./confirm-domain";
import {
  gmbSearchQuery,
  hitsFromSerperJson,
  mapsAddressMatchesReceita,
  mapsPhoneMatchesReceita,
  pickBestDomainHit,
  pickBestMapsPlace,
  pickSocialHit,
  presenceQuery,
  scoreDomainHit,
  socialHitMatchesBrand,
  socialHitMatchesLoose,
  titleMatchesCompany,
} from "./presence";

describe("titleMatchesCompany", () => {
  it("matches distinctive tokens from fantasia", () => {
    expect(
      titleMatchesCompany(
        "Marmoraria Carvalho | Itaúna",
        "MARMORARIA CARVALHO LTDA",
        "Marmoraria Carvalho",
        "Itauna",
      ),
    ).toBe(true);
  });

  it("rejects unrelated titles", () => {
    expect(
      titleMatchesCompany(
        "Clínica odontológica Centro",
        "MARMORARIA CARVALHO LTDA",
        "Marmoraria Carvalho",
        "Itauna",
      ),
    ).toBe(false);
  });

  it("allows weak-only brands on GMB when ≥2 tokens match", () => {
    expect(
      titleMatchesCompany(
        "Distribuidora Silva Contagem",
        "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
        "DISTRIBUIDORA SILVA",
        "Contagem",
      ),
    ).toBe(true);
  });
});

describe("socialHitMatchesBrand / pickSocialHit", () => {
  it("prefers a host match whose title has company tokens", () => {
    expect(
      pickSocialHit(
        [
          {
            link: "https://instagram.com/outra",
            title: "Outra Loja",
          },
          {
            link: "https://instagram.com/marmorariacarvalho",
            title: "Marmoraria Carvalho Itauna",
          },
        ],
        "instagram.com",
        "MARMORARIA CARVALHO LTDA",
        "Marmoraria Carvalho",
        "Itauna",
      ),
    ).toBe("https://instagram.com/marmorariacarvalho");
  });

  it("rejects host hits when no title matches the brand", () => {
    expect(
      pickSocialHit(
        [
          {
            link: "https://instagram.com/aleatorio",
            title: "Perfil aleatório BH",
          },
        ],
        "instagram.com",
        "Genesis Sociedade de Ensino Ltda",
        "Genesis",
        "Belo Horizonte",
      ),
    ).toBeNull();
  });

  it("rejects @sagem for Distribuidora Silva (false positive)", () => {
    const hit = {
      link: "https://www.instagram.com/sagem/",
      title: "Sage Michaels (@sagem) • Instagram photos and videos",
      snippet: "Picker | Herb | Hoarder",
    };
    expect(
      socialHitMatchesBrand(
        hit,
        "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
        "DISTRIBUIDORA SILVA",
        "Contagem",
      ),
    ).toBe(false);
    expect(
      pickSocialHit(
        [hit],
        "instagram.com",
        "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
        "DISTRIBUIDORA SILVA",
        "Contagem",
      ),
    ).toBeNull();
  });

  it("rejects provider-label handles even if title mentions the company", () => {
    expect(
      pickSocialHit(
        [
          {
            link: "https://instagram.com/contajul/",
            title: "Contajul — parceiro TNA Lubrificacao Contagem",
            snippet: "Escritório contábil",
          },
        ],
        "instagram.com",
        "TNA LUBRIFICACAO E LIMPEZA AUTOMOTIVA LTDA",
        "TNA Lubrificacao",
        "Contagem",
        ["contajul"],
      ),
    ).toBeNull();
  });

  it("refuses search match when the brand has only weak tokens", () => {
    expect(
      presenceBrandTokens(
        "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
        "DISTRIBUIDORA SILVA",
        "Contagem",
      ),
    ).toEqual([]);
    expect(
      socialHitMatchesBrand(
        {
          link: "https://instagram.com/distribuidorasilva",
          title: "Distribuidora Silva Contagem",
        },
        "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
        "DISTRIBUIDORA SILVA",
        "Contagem",
      ),
    ).toBe(false);
  });
});

describe("presenceQuery", () => {
  it("searches Instagram with fantasia first", () => {
    expect(
      presenceQuery(
        "instagram",
        "Marmoraria Carvalho",
        "MARMORARIA CARVALHO LTDA",
        "Itauna",
        "MG",
      ),
    ).toBe('site:instagram.com "Marmoraria Carvalho" Itauna MG');
  });

  it("uses brand override when provided", () => {
    expect(
      presenceQuery(
        "instagram",
        "Genesis",
        "Genesis Sociedade de Ensino Ltda",
        "Belo Horizonte",
        "MG",
        "Colégio Genesis",
      ),
    ).toBe('site:instagram.com "Colégio Genesis" Belo Horizonte MG');
  });

  it("drops the site: operator on a web Instagram query", () => {
    expect(
      presenceQuery(
        "instagram",
        "Marmoraria Carvalho",
        "MARMORARIA CARVALHO LTDA",
        "Itauna",
        "MG",
        null,
        "web",
      ),
    ).toBe('"Marmoraria Carvalho" Instagram Itauna MG');
  });
});

describe("pickBestDomainHit", () => {
  it("picks the hit with brand tokens over an unrelated top result", () => {
    const best = pickBestDomainHit(
      [
        {
          link: "https://portal-educacao.com.br/lista",
          title: "Escolas particulares em MG",
          snippet: "Ranking de escolas",
        },
        {
          link: "https://colegiogenesis.com.br/",
          title: "Colégio Genesis — Belo Horizonte",
          snippet: "Educação infantil Genesis",
        },
      ],
      "Genesis Sociedade de Ensino Ltda",
      "Genesis",
      "Belo Horizonte",
    );
    expect(best?.link).toBe("https://colegiogenesis.com.br/");
  });

  it("returns null when no hit meets the brand score floor", () => {
    expect(
      pickBestDomainHit(
        [
          {
            link: "https://noticias.com.br/educacao",
            title: "Notícias de educação",
            snippet: "Lista de escolas",
          },
        ],
        "Genesis Sociedade de Ensino Ltda",
        "Genesis",
        "Belo Horizonte",
      ),
    ).toBeNull();
  });

  it("scores title token overlap", () => {
    expect(
      scoreDomainHit(
        { link: "https://x.com", title: "Genesis BH", snippet: "" },
        "Genesis Sociedade de Ensino Ltda",
        "Genesis",
        "Belo Horizonte",
      ),
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("Maps × Receita matching", () => {
  const silva = {
    nomeFantasia: "DISTRIBUIDORA SILVA",
    razaoSocial: "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
    municipio: "Contagem",
    uf: "MG",
    logradouro: "Rua das Palmeiras",
    numero: "100",
    phones: [{ ddd: "31", telefone: "33331111" }],
  };

  it("matches Maps phone to Receita DDD + number", () => {
    expect(
      mapsPhoneMatchesReceita("(31) 3333-1111", silva.phones),
    ).toBe(true);
    expect(
      mapsPhoneMatchesReceita("(11) 4002-8922", silva.phones),
    ).toBe(false);
  });

  it("requires street name and number, not just the city", () => {
    expect(
      mapsAddressMatchesReceita(
        "Rua das Palmeiras, 100 - Centro, Contagem - MG",
        silva,
      ),
    ).toBe(true);
    expect(
      mapsAddressMatchesReceita("Centro, Contagem - MG, 32000-000", silva),
    ).toBe(false);
  });

  it("ranks the place that matches Receita phone over the first result", () => {
    const best = pickBestMapsPlace(
      [
        {
          title: "Padaria do Centro",
          website: "https://padaria.com.br",
          address: "Av. João César, 1 - Contagem - MG",
        },
        {
          title: "Auto Peças Silva",
          phoneNumber: "(31) 3333-1111",
          website: "https://silva-pecas.com.br",
          address: "Rua das Palmeiras, 100 - Contagem - MG",
        },
      ],
      silva,
    );
    expect(best?.place.website).toBe("https://silva-pecas.com.br");
    expect(best?.match_by).toEqual(expect.arrayContaining(["phone", "address"]));
  });

  it("builds a GMB query with street", () => {
    expect(gmbSearchQuery(silva)).toBe(
      '"DISTRIBUIDORA SILVA" Rua das Palmeiras, 100 Contagem MG',
    );
  });

  it("rejects a neighbor listing that only shares the street address", () => {
    const atos = {
      nomeFantasia: "GRUPO ATOS",
      razaoSocial: "GRUPO ATOS LTDA",
      municipio: "Belo Horizonte",
      uf: "MG",
      logradouro: "Rua da Bahia",
      numero: "2741",
      phones: [{ ddd: "31", telefone: "92182314" }],
    };
    expect(
      pickBestMapsPlace(
        [
          {
            title: "Floricultura Via das Flores",
            address: "Rua da Bahia, 2741 - Lourdes, Belo Horizonte - MG",
            website: "https://viadasflores.com.br",
          },
        ],
        atos,
      ),
    ).toBeNull();
  });
});

describe("gmbListingCorroborated", () => {
  it("accepts phone, or address together with title — never address-only", () => {
    expect(
      gmbListingCorroborated({
        name: "X",
        url: "https://maps.google.com/?cid=1",
        matched: true,
        match_by: ["address"],
      }),
    ).toBe(false);
    expect(
      gmbListingCorroborated({
        name: "X",
        url: "https://maps.google.com/?cid=1",
        matched: true,
        match_by: ["phone"],
      }),
    ).toBe(true);
    expect(
      gmbListingCorroborated({
        name: "X",
        url: "https://maps.google.com/?cid=1",
        matched: true,
        match_by: ["title", "address"],
      }),
    ).toBe(true);
  });
});

describe("hitsFromSerperJson", () => {
  it("pulls Instagram out of Knowledge Graph attributes and sitelinks", () => {
    const hits = hitsFromSerperJson({
      knowledgeGraph: {
        title: "Colégio Genesis",
        website: "https://colegiogenesis.com.br",
        attributes: {
          Instagram: "https://www.instagram.com/colegiogenesis/",
        },
      },
      organic: [
        {
          link: "https://colegiogenesis.com.br/",
          title: "Colégio Genesis BH",
          snippet: "Siga no instagram.com/colegiogenesis",
          sitelinks: [
            {
              title: "Facebook",
              link: "https://www.facebook.com/colegiogenesis",
            },
          ],
        },
      ],
    });
    expect(hits.some((h) => h.via === "kg" && h.link.includes("instagram"))).toBe(
      true,
    );
    expect(hits.some((h) => h.link.includes("facebook.com/colegiogenesis"))).toBe(
      true,
    );
  });
});

describe("socialHitMatchesLoose", () => {
  it("accepts a weak-brand Instagram when title has ≥2 distinctive tokens", () => {
    const hit = {
      link: "https://instagram.com/distribuidorasilvacontagem",
      title: "Distribuidora Silva Contagem",
    };
    expect(
      socialHitMatchesBrand(
        hit,
        "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
        "DISTRIBUIDORA SILVA",
        "Contagem",
      ),
    ).toBe(false);
    expect(
      socialHitMatchesLoose(
        hit,
        "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
        "DISTRIBUIDORA SILVA",
        "Contagem",
      ),
    ).toBe(true);
  });

  it("still rejects @sagem for Distribuidora Silva", () => {
    expect(
      pickSocialHit(
        [
          {
            link: "https://www.instagram.com/sagem/",
            title: "Sage Michaels (@sagem)",
          },
        ],
        "instagram.com",
        "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
        "DISTRIBUIDORA SILVA",
        "Contagem",
        [],
        true,
      ),
    ).toBeNull();
  });
});
