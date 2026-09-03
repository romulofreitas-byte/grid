import { describe, expect, it } from "vitest";
import { gmbListingCorroborated } from "@/lib/types";
import { presenceBrandTokens } from "./confirm-domain";
import {
  gmbCardFromPlace,
  gmbSearchQuery,
  gmbSearchQueryList,
  hitsFromSerperJson,
  mapsAddressMatchesReceita,
  mapsCityMatchesReceita,
  mapsPhoneMatchesReceita,
  pickBestDomainHit,
  pickBestMapsPlace,
  pickSocialHit,
  presenceQuery,
  scoreDomainHit,
  scoreMapsPlace,
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

  it("prefers a branded host over a school directory with the same title tokens", () => {
    const best = pickBestDomainHit(
      [
        {
          link: "https://escolasbrasil.org/minas-gerais/belo-horizonte/31007196",
          title: "Colegio Santa Doroteia — Belo Horizonte/MG",
          snippet: "Colégio Santa Doroteia em Belo Horizonte",
        },
        {
          link: "https://santadoroteiabh.com.br/",
          title: "Colégio Santa Dorotéia de Belo Horizonte",
          snippet: "Educação infantil, fundamental e médio",
        },
      ],
      "CONGREGACAO DE SANTA DOROTEIA DO BRASIL - SUL",
      "COLEGIO SANTA DOROTEIA",
      "Belo Horizonte",
    );
    expect(best?.link).toBe("https://santadoroteiabh.com.br/");
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

  it("builds a GMB query with city first; street is opt-in", () => {
    expect(gmbSearchQuery(silva)).toBe('"DISTRIBUIDORA SILVA" Contagem MG');
    expect(gmbSearchQuery(silva, { includeStreet: true })).toBe(
      '"DISTRIBUIDORA SILVA" Rua das Palmeiras, 100 Contagem MG',
    );
    expect(gmbSearchQuery(silva, { quoted: false })).toBe(
      "DISTRIBUIDORA SILVA Contagem MG",
    );
  });

  it("omits the Receita street when the phone is the accountant's", () => {
    expect(
      gmbSearchQueryList({ ...silva, sharedVerdict: "contabilidade" }),
    ).toEqual([
      '"DISTRIBUIDORA SILVA" Contagem MG',
      "DISTRIBUIDORA SILVA Contagem MG",
    ]);
    expect(gmbSearchQueryList(silva)).toEqual([
      '"DISTRIBUIDORA SILVA" Contagem MG',
      '"DISTRIBUIDORA SILVA" Rua das Palmeiras, 100 Contagem MG',
      "DISTRIBUIDORA SILVA Contagem MG",
    ]);
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

  it("matches a strong brand on title + city when the Receita phone is the office", () => {
    const delpra = {
      nomeFantasia: "Delpra Pré-Moldados",
      razaoSocial: "DELPRA PRE MOLDADOS LTDA",
      municipio: "Uberaba",
      uf: "MG",
      logradouro: "Rua do Contador",
      numero: "10",
      phones: [{ ddd: "34", telefone: "33123659" }],
      sharedVerdict: "contabilidade" as const,
    };
    const best = pickBestMapsPlace(
      [
        {
          title: "Escritório Contábil Centro",
          address: "Rua do Contador, 10 - Uberaba - MG",
          phoneNumber: "(34) 3312-3659",
        },
        {
          title: "Delpra Pré-Moldados",
          address:
            "R. Clara Alves de Mello, 461 - Laranjeiras, Uberaba - MG",
          website: "https://delpra.net.br",
          phoneNumber: "(34) 99912-2128",
          rating: 5,
          ratingCount: 49,
        },
      ],
      delpra,
    );
    expect(best?.place.website).toBe("https://delpra.net.br");
    expect(best?.match_by).toEqual(expect.arrayContaining(["title", "city"]));
    expect(best?.match_by).not.toContain("phone");
    expect(best?.match_by).not.toContain("address");
  });

  it("does not accept a weak brand on title + city without street or phone", () => {
    expect(
      pickBestMapsPlace(
        [
          {
            title: "Distribuidora Silva Contagem",
            address: "Av. João César, 1 - Contagem - MG",
            website: "https://silva-errada.com.br",
          },
        ],
        silva,
      ),
    ).toBeNull();
    expect(
      scoreMapsPlace(
        {
          title: "Distribuidora Silva Contagem",
          address: "Av. João César, 1 - Contagem - MG",
        },
        silva,
      ).matched,
    ).toBe(false);
  });

  it("prefers the listing with more reviews when identity scores tie", () => {
    const input = {
      nomeFantasia: "Delpra Pré-Moldados",
      razaoSocial: "DELPRA PRE MOLDADOS LTDA",
      municipio: "Uberaba",
      uf: "MG",
    };
    const best = pickBestMapsPlace(
      [
        {
          title: "Delpra Pré-Moldados",
          address: "Uberaba - MG",
          website: "https://delpra-velho.net.br",
          ratingCount: 2,
        },
        {
          title: "Delpra Pré-Moldados",
          address: "Uberaba - MG",
          website: "https://delpra.net.br",
          rating: 5,
          ratingCount: 49,
        },
      ],
      input,
    );
    expect(best?.place.website).toBe("https://delpra.net.br");
  });

  it("treats municipality in the Maps title as a city match", () => {
    expect(
      mapsCityMatchesReceita("Solaris Belo Horizonte", {
        municipio: "Belo Horizonte",
        uf: "MG",
      }),
    ).toBe(true);
    expect(
      mapsCityMatchesReceita("Contagem - MG", {
        municipio: "Uberaba",
        uf: "MG",
      }),
    ).toBe(false);
  });
});

describe("gmbListingCorroborated", () => {
  it("accepts phone, street+title, or title+city — never address-only", () => {
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
    expect(
      gmbListingCorroborated({
        name: "Delpra",
        url: "https://delpra.net.br",
        matched: true,
        match_by: ["title", "city"],
      }),
    ).toBe(true);
  });
});

describe("gmbCardFromPlace", () => {
  it("scores a full public card without storing hours or photo URLs", () => {
    const card = gmbCardFromPlace({
      title: "Distribuidora Silva",
      phoneNumber: "(31) 3333-1111",
      website: "https://silva-pecas.com.br",
      openingHours: ["Monday: 8AM-6PM"],
      thumbnailUrl: "https://lh3.googleusercontent.com/photo",
      rating: 4.2,
      ratingCount: 37,
      category: "Auto parts store",
    });
    expect(card.score).toBe(5);
    expect(card.filled).toEqual([
      "phone",
      "website",
      "hours",
      "photo",
      "reviews",
    ]);
    expect(card.rating).toBe(4.2);
    expect(card.ratingCount).toBe(37);
    expect(card.category).toBe("Auto parts store");
    expect(JSON.stringify(card)).not.toMatch(/8AM-6PM/);
    expect(JSON.stringify(card)).not.toMatch(/googleusercontent/);
  });

  it("treats a Maps website as missing and a title-only place as empty", () => {
    expect(
      gmbCardFromPlace({
        title: "Padaria",
        website: "https://maps.google.com/?cid=1",
      }).filled,
    ).toEqual([]);
    expect(gmbCardFromPlace({ title: "Padaria" }).score).toBe(0);
  });

  it("counts hours from an object shape", () => {
    expect(
      gmbCardFromPlace({
        title: "Clínica",
        openingHours: { monday: "9:00-18:00" },
      }).filled,
    ).toContain("hours");
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
