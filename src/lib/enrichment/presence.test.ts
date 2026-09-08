import { afterEach, describe, expect, it, vi } from "vitest";
import { gmbListingCorroborated } from "@/lib/types";
import { presenceBrandTokens } from "./confirm-domain";
import {
  domainFromGmb,
  gmbCardFromPlace,
  gmbCompactSearchName,
  gmbEmailBrandLabel,
  gmbHydrationQueries,
  gmbListingNeedsHydration,
  gmbSearchQuery,
  gmbSearchQueryList,
  pickGmbSearchQueries,
  hydrateMatchedGmbListing,
  mapsWebsiteAssets,
  applyMapsWebsiteAssets,
  mapsStructuredQueries,
  hitsFromSerperJson,
  instagramSearchQueries,
  mergeMapsPlaceOntoListing,
  preferGmbListing,
  searchInstagramProfile,
  mapsAddressMatchesReceita,
  websiteHostFromMapsPlace,
  mapsCepMatchesReceita,
  mapsCityMatchesReceita,
  mapsPhoneMatchesReceita,
  mapsPlaceListingUrl,
  pickBestCandidateMapsPlace,
  pickBestDomainHit,
  pickBestMapsPlace,
  pickSocialHit,
  presenceQuery,
  resolveGmbListing,
  scoreDomainHit,
  scoreMapsPlace,
  searchGmb,
  socialHandleMatchesBrand,
  socialHitMatchesBrand,
  socialHitMatchesLoose,
  titleMatchesCompany,
  upgradeGmbWithWebsite,
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
        { blockedLabels: ["contajul"] },
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

  it("does not auto-attach a personal Instagram that only mentions the company", () => {
    const hit = {
      link: "https://instagram.com/pvdlacoste9",
      title: "pvdlacoste9",
      snippet:
        "Tive a oportunidade de conhecer Doces Aritana, empresa que faz parte da história da região #DocesAritana #Caeté",
    };
    expect(
      socialHitMatchesBrand(
        hit,
        "DOCES ARITANA LTDA",
        "Doces Aritana",
        "Caete",
      ),
    ).toBe(false);
    expect(
      socialHandleMatchesBrand(
        hit.link,
        "DOCES ARITANA LTDA",
        "Doces Aritana",
        "Caete",
      ),
    ).toBe(false);
    expect(
      pickSocialHit(
        [hit],
        "instagram.com",
        "DOCES ARITANA LTDA",
        "Doces Aritana",
        "Caete",
        { allowCitySnippet: true },
      ),
    ).toBeNull();
  });

  it("auto-attaches an Instagram handle that contains the brand", () => {
    expect(
      pickSocialHit(
        [
          {
            link: "https://instagram.com/docesaritana",
            title: "Doces Aritana (@docesaritana)",
          },
        ],
        "instagram.com",
        "DOCES ARITANA LTDA",
        "Doces Aritana",
        "Caete",
      ),
    ).toBe("https://instagram.com/docesaritana");
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

  it("skips a Serasa Experian listing even when the title matches the brand", () => {
    expect(
      pickBestDomainHit(
        [
          {
            link: "https://empresas.serasaexperian.com.br/consulta/ls-estetica",
            title: "LS ESTETICA AUTOMOTIVA LTDA - Consulta CNPJ | Serasa",
            snippet: "CNPJ e dados cadastrais de LS ESTETICA AUTOMOTIVA",
          },
        ],
        "LS ESTETICA AUTOMOTIVA LTDA",
        "LS ESTETICA AUTOMOTIVA",
        "Belo Horizonte",
      ),
    ).toBeNull();
  });

  it("skips a national guia host like ondefica even when the title matches", () => {
    expect(
      pickBestDomainHit(
        [
          {
            link: "https://lavarapido.ondefica.com.br/mg/belo-horizonte/lava-jato-silveira",
            title: "Lava Jato Silveira — Belo Horizonte/MG",
            snippet: "Endereço e telefone do lava jato",
          },
        ],
        "LAVA JATO SILVEIRA LTDA",
        "LAVA JATO SILVEIRA",
        "Belo Horizonte",
      ),
    ).toBeNull();
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

  it("skips a CNPJ aggregator even when the title matches the company", () => {
    expect(
      pickBestDomainHit(
        [
          {
            link: "https://cnpjgo.com.br/empresas/00291345000141",
            title: "DOCES ARITANA — CNPJ 00.291.345/0001-41 | CNPJ Go",
            snippet: "Consulta CNPJ grátis de Doces Aritana em Caeté MG",
          },
        ],
        "DOCES ARITANA LTDA",
        "Doces Aritana",
        "Caete",
      ),
    ).toBeNull();
  });

  it("skips an unbranded host even when the title cites the company", () => {
    expect(
      pickBestDomainHit(
        [
          {
            link: "https://portalxyz.com.br/doces-aritana",
            title: "DOCES ARITANA Caeté MG",
            snippet: "Fábrica de doces em Caeté",
          },
        ],
        "DOCES ARITANA LTDA",
        "Doces Aritana",
        "Caete",
      ),
    ).toBeNull();
  });

  it("still picks a branded host for Doces Aritana", () => {
    const best = pickBestDomainHit(
      [
        {
          link: "https://cnpjgo.com.br/empresas/00291345000141",
          title: "DOCES ARITANA — CNPJ Go",
          snippet: "Consulta CNPJ",
        },
        {
          link: "https://docesaritana.com.br/",
          title: "Doces Aritana",
          snippet: "Fábrica de doces em Caeté",
        },
      ],
      "DOCES ARITANA LTDA",
      "Doces Aritana",
      "Caete",
    );
    expect(best?.link).toBe("https://docesaritana.com.br/");
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

  it("scores a concatenated Metalúrgica Vaz host", () => {
    expect(
      scoreDomainHit(
        {
          link: "https://www.metalurgicavaz.com.br/",
          title: "Home",
          snippet: "",
        },
        "VAZ E VAZ METALURGIA LTDA",
        "Metalúrgica Vaz",
        "Contagem",
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
    expect(
      mapsAddressMatchesReceita("Rua das Palmeiras, 100 - Santa Tereza", silva),
    ).toBe(true);
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
    ).toEqual(
      expect.arrayContaining([
        '"DISTRIBUIDORA SILVA" Contagem MG',
        "DISTRIBUIDORA SILVA Contagem MG",
      ]),
    );
    expect(gmbSearchQueryList(silva)).toEqual(
      expect.arrayContaining([
        "3133331111 Contagem MG",
        "Rua das Palmeiras, 100 Contagem MG",
        '"DISTRIBUIDORA SILVA" Contagem MG',
        '"DISTRIBUIDORA SILVA" Rua das Palmeiras, 100 Contagem MG',
        "DISTRIBUIDORA SILVA Contagem MG",
      ]),
    );
    expect(mapsStructuredQueries(silva)[0]).toBe("3133331111 Contagem MG");
    expect(gmbSearchQueryList(silva)[0]).toBe("3133331111 Contagem MG");
  });

  it("adds a compact brand query when the Receita name is longer than the Maps title", () => {
    const futura = {
      nomeFantasia: "FUTURA EMPREENDIMENTOS E NEGOCIOS IMOBILIARIOS",
      razaoSocial: "FUTURA EMPREENDIMENTOS E NEGOCIOS IMOBILIARIOS LTDA",
      municipio: "Vicosa",
      uf: "MG",
      logradouro: "Rua X",
      numero: "1",
    };
    expect(gmbCompactSearchName(futura)).toBe("futura");
    expect(gmbSearchQueryList(futura)).toContain('"futura" Vicosa MG');
    expect(gmbCompactSearchName(silva)).toBeNull();
  });

  it("picks street plus brand and skips a landline so Maps still gets the company name", () => {
    const futura = {
      nomeFantasia: "FUTURA EMPREENDIMENTOS E NEGOCIOS IMOBILIARIOS",
      razaoSocial: "FUTURA EMPREENDIMENTOS E NEGOCIOS IMOBILIARIOS LTDA",
      municipio: "Vicosa",
      uf: "MG",
      logradouro: "Rua X",
      numero: "1",
      phones: [{ ddd: "31", telefone: "38924111" }],
    };
    const picked = pickGmbSearchQueries(futura);
    expect(picked).toHaveLength(2);
    expect(picked[0]).toBe("Rua X, 1 Vicosa MG");
    expect(picked[1]).toBe("futura Vicosa MG");
    expect(picked.some((q) => /^3138924111\b/.test(q))).toBe(false);
  });

  it("uses the 11-digit mobile plus brand when Receita lists two phones", () => {
    const nanotech = {
      nomeFantasia: "NANOTECH",
      razaoSocial: "NANOTECH LTDA",
      municipio: "Belo Horizonte",
      uf: "MG",
      logradouro: "Rua Senador Campos Vergueiro",
      numero: "95",
      phones: [
        { ddd: "31", telefone: "88783666" },
        { ddd: "31", telefone: "988783666" },
      ],
    };
    const picked = pickGmbSearchQueries(nanotech);
    expect(picked).toHaveLength(2);
    expect(picked[0]).toBe("31988783666 Belo Horizonte MG");
    expect(picked.some((q) => /^3188783666\b/.test(q))).toBe(false);
    expect(picked[1]).toMatch(/nanotech/i);
    expect(picked[1]).not.toMatch(/Rua Senador/);
  });

  it("skips locator queries for an accountant shared phone", () => {
    const picked = pickGmbSearchQueries({
      nomeFantasia: "Pizza Hut",
      razaoSocial: "PH GOIANIA ALIMENTOS LTDA",
      municipio: "Goiania",
      uf: "GO",
      logradouro: "Rua do Contador",
      numero: "10",
      phones: [{ ddd: "62", telefone: "40024003" }],
      sharedVerdict: "contabilidade",
    });
    expect(picked).toEqual(['"Pizza Hut" Goiania GO']);
  });

  it("searches the short Maps brand before the long Receita name", () => {
    const drimafer = {
      nomeFantasia: null,
      razaoSocial:
        "DRIMAFER MAQUINAS E EQUIPAMENTOS PARA CONSTRUCAO CIVIL LTDA",
      municipio: "Diadema",
      uf: "SP",
      logradouro: "Rua Tupinambas",
      numero: "1267",
      cep: "09991090",
      receitaEmail: "marcia@drimafer.com.br",
    };
    expect(gmbCompactSearchName(drimafer)).toBe("drimafer");
    expect(gmbEmailBrandLabel(drimafer)).toBe("drimafer");
    const queries = gmbSearchQueryList(drimafer);
    expect(queries[0]).toBe("Rua Tupinambas, 1267 Diadema SP");
    expect(queries).toContain("drimafer Diadema SP");
    expect(queries).toContain('"drimafer" Diadema SP');
    expect(queries.some((q) => /MAQUINAS E EQUIPAMENTOS/i.test(q))).toBe(true);
  });

  it("does not use a free or accountant email as a Maps brand", () => {
    expect(
      gmbEmailBrandLabel({
        nomeFantasia: null,
        razaoSocial: "DRIMAFER MAQUINAS E EQUIPAMENTOS PARA CONSTRUCAO CIVIL LTDA",
        municipio: "Diadema",
        uf: "SP",
        receitaEmail: "marcia@gmail.com",
      }),
    ).toBeNull();
  });

  it("does not search a generic razão token before a short fantasia", () => {
    const pizza = {
      nomeFantasia: "Pizza Hut",
      razaoSocial: "PH GOIANIA ALIMENTOS LTDA",
      municipio: "Goiania",
      uf: "GO",
    };
    expect(gmbCompactSearchName(pizza)).toBe("pizza");
    expect(gmbSearchQueryList(pizza)[0]).toBe('"Pizza Hut" Goiania GO');
  });

  it("searches the live Maps name, not a generic studio token", () => {
    const studio = {
      nomeFantasia: "STUDIO SANTA TEREZA",
      razaoSocial: "STUDIO SANTA TEREZA LTDA",
      municipio: "Belo Horizonte",
      uf: "MG",
      logradouro: "Rua Marmore",
      numero: "196",
      phones: [{ ddd: "31", telefone: "25555527" }],
    };
    expect(gmbCompactSearchName(studio)).toBe("santa tereza");
    const queries = gmbSearchQueryList(studio);
    expect(queries[0]).toBe("3125555527 Belo Horizonte MG");
    expect(queries).toContain("santa tereza Belo Horizonte MG");
    expect(queries).toContain('"santa tereza" Belo Horizonte MG');
    expect(queries).not.toContain("studio Belo Horizonte MG");
    expect(queries).not.toContain(`"studio" Belo Horizonte MG`);
  });

  it("searches CNAE trade + brand so Maps titles like Vidraçaria Modular match", () => {
    const modular = {
      nomeFantasia: "MODULAR SOLUCOES",
      razaoSocial: "MODULAR SOLUCOES LTDA",
      municipio: "Claudio",
      uf: "MG",
      cnaeDescricao: "Comércio varejista de vidros",
    };
    const queries = gmbSearchQueryList(modular);
    expect(queries).toEqual(
      expect.arrayContaining([
        '"Vidraçarias modular" Claudio MG',
        "Vidraçarias modular Claudio MG",
      ]),
    );
  });

  it("searches a Maps trading name even when it does not start with the brand token", () => {
    const queries = gmbSearchQueryList({
      nomeFantasia: "MODULAR SOLUCOES",
      razaoSocial: "MODULAR SOLUCOES LTDA",
      municipio: "Claudio",
      uf: "MG",
      extraNames: ["Vidraçaria Modular"],
    });
    expect(queries).toEqual(
      expect.arrayContaining([
        "Vidraçaria Modular Claudio MG",
        '"Vidraçaria Modular" Claudio MG',
      ]),
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

  it("auto-matches a unique weak-brand pin in the Receita city", () => {
    const places = [
      {
        title: "Distribuidora Silva Contagem",
        address: "Av. João César, 1 - Contagem - MG",
        website: "https://silva-errada.com.br",
        cid: "88",
      },
    ];
    expect(pickBestMapsPlace(places, silva)?.place.cid).toBe("88");
    expect(
      scoreMapsPlace(
        {
          title: "Distribuidora Silva Contagem",
          address: "Av. João César, 1 - Contagem - MG",
        },
        silva,
      ).matched,
    ).toBe(true);
    const listing = resolveGmbListing(places, silva);
    expect(listing.status).toBe("matched");
    expect(listing.matched).toBe(true);
    expect(listing.cid).toBe("88");
  });

  it("matches a Maps card whose website host is the brand, before a crawl", () => {
    const listing = resolveGmbListing(
      [
        {
          title: "Delpra Pré-Moldados",
          address: "Uberaba - MG",
          website: "https://delpra.net.br",
          cid: "49",
        },
      ],
      {
        nomeFantasia: "Delpra Pré-Moldados",
        razaoSocial: "DELPRA PRE MOLDADOS LTDA",
        municipio: "Uberaba",
        uf: "MG",
      },
    );
    expect(listing.matched).toBe(true);
    expect(listing.match_by).toEqual(expect.arrayContaining(["website"]));
    expect(listing.website_host).toBe("delpra.net.br");
    expect(domainFromGmb(listing)).toBe("delpra.net.br");
  });

  it("does not treat a Serasa Maps website as the company domain", () => {
    expect(
      domainFromGmb({
        name: "LS ESTETICA AUTOMOTIVA",
        url: "https://maps.google.com/?cid=1",
        matched: true,
        status: "matched",
        website_host: "empresas.serasaexperian.com.br",
        website_url: "https://empresas.serasaexperian.com.br/consulta/foo",
      }),
    ).toBeNull();
  });

  it("does not treat CNPJ Go as a Maps website", () => {
    expect(
      domainFromGmb({
        name: "DOCES ARITANA",
        url: "https://maps.google.com/?cid=1",
        matched: true,
        status: "matched",
        website_host: "cnpjgo.com.br",
        website_url: "https://cnpjgo.com.br/empresas/00291345000141",
      }),
    ).toBeNull();
  });

  it("keeps an unbranded Maps website that is not a directory", () => {
    expect(
      domainFromGmb({
        name: "DOCES ARITANA",
        url: "https://maps.google.com/?cid=1",
        matched: true,
        status: "matched",
        website_host: "docesartesanais.com.br",
        website_url: "https://docesartesanais.com.br/",
      }),
    ).toBe("docesartesanais.com.br");
  });

  it("auto-matches a trading-name pin when the Receita phone is on the Maps card", () => {
    const listing = resolveGmbListing(
      [
        {
          title: "Santa Tereza Pilates & Funcional",
          address: "R. Mármore, 196 - Santa Tereza",
          phoneNumber: "(31) 2555-5527",
          website: "https://santaterezapilates.com.br",
          cid: "55",
          rating: 4.7,
          ratingCount: 27,
          openingHours: ["Fecha 21:30"],
          thumbnailUrl: "https://img.test/studio.jpg",
          category: "Estúdio de pilates",
        },
      ],
      {
        nomeFantasia: "STUDIO SANTA TEREZA",
        razaoSocial: "STUDIO SANTA TEREZA LTDA",
        municipio: "Belo Horizonte",
        uf: "MG",
        logradouro: "Rua Marmore",
        numero: "196",
        phones: [{ ddd: "31", telefone: "25555527" }],
      },
    );
    expect(listing.matched).toBe(true);
    expect(listing.status).toBe("matched");
    expect(listing.name).toBe("Santa Tereza Pilates & Funcional");
    expect(listing.match_by).toEqual(
      expect.arrayContaining(["phone", "title", "address", "website"]),
    );
    expect(listing.website_host).toBe("santaterezapilates.com.br");
    expect(listing.phone_vs_receita).toBe("igual");
    expect(listing.card?.score).toBe(5);
    expect(domainFromGmb(listing)).toBe("santaterezapilates.com.br");
  });

  it("auto-matches a unique trading-name pin from website + title without city in the address", () => {
    const listing = resolveGmbListing(
      [
        {
          title: "Santa Tereza Pilates & Funcional",
          address: "R. Mármore, 196 - Santa Tereza",
          website: "https://santaterezapilates.com.br",
          cid: "55",
        },
      ],
      {
        nomeFantasia: "STUDIO SANTA TEREZA",
        razaoSocial: "STUDIO SANTA TEREZA LTDA",
        municipio: "Belo Horizonte",
        uf: "MG",
      },
    );
    expect(listing.matched).toBe(true);
    expect(listing.match_by).toEqual(
      expect.arrayContaining(["title", "website"]),
    );
    expect(domainFromGmb(listing)).toBe("santaterezapilates.com.br");
  });

  it("keeps a unique trading-name pin as a candidate when the list card has no phone or site", () => {
    const listing = resolveGmbListing(
      [
        {
          title: "Santa Tereza Pilates & Funcional",
          address: "R. Mármore, 196 - Santa Tereza",
          cid: "55",
        },
      ],
      {
        nomeFantasia: "STUDIO SANTA TEREZA",
        razaoSocial: "STUDIO SANTA TEREZA LTDA",
        municipio: "Belo Horizonte",
        uf: "MG",
      },
    );
    expect(listing.matched).toBe(false);
    expect(listing.status).toBe("candidate");
    expect(listing.cid).toBe("55");
  });

  it("promotes a moved-address pin when the Maps phone matches the site", () => {
    const listing = resolveGmbListing(
      [
        {
          title: "Distribuidora Silva Contagem",
          address: "Rua Nova, 50 - Contagem - MG",
          phoneNumber: "(31) 98888-0001",
          cid: "91",
        },
      ],
      {
        ...silva,
        sitePhones: [{ ddd: "31", telefone: "988880001" }],
      },
    );
    expect(listing.matched).toBe(true);
    expect(listing.match_by).toEqual(expect.arrayContaining(["phone"]));
    expect(listing.cid).toBe("91");
  });

  it("prefers the listing with more reviews when identity scores tie", () => {
    const input = {
      nomeFantasia: "Delpra Pré-Moldados",
      razaoSocial: "DELPRA PRE MOLDADOS LTDA",
      municipio: "Uberaba",
      uf: "MG",
    };
    const places = [
      {
        title: "Delpra Pré-Moldados",
        address: "Uberaba - MG",
        website: "https://delpra-velho.net.br",
        cid: "1",
        ratingCount: 2,
      },
      {
        title: "Delpra Pré-Moldados",
        address: "Uberaba - MG",
        website: "https://delpra.net.br",
        cid: "2",
        rating: 5,
        ratingCount: 49,
      },
    ];
    expect(pickBestMapsPlace(places, input)).toBeNull();
    const listing = resolveGmbListing(places, input);
    expect(listing.status).toBe("candidate");
    expect(listing.website_host).toBe("delpra.net.br");
    expect(listing.cid).toBe("2");
  });

  it("does not match a chain when several brand cards share the city", () => {
    const hut = {
      nomeFantasia: "Pizza Hut",
      razaoSocial: "PH GOIANIA ALIMENTOS LTDA",
      municipio: "Goiania",
      uf: "GO",
      logradouro: "Rua do Contador",
      numero: "10",
      phones: [{ ddd: "62", telefone: "40024003" }],
      sharedVerdict: "contabilidade" as const,
    };
    const places = [
      {
        title: "Pizza Hut",
        address: "Av. T-63, 100 - Goiânia - GO",
        phoneNumber: "(62) 3250-1111",
        website: "https://pizzahutgo.com",
        cid: "111",
        rating: 4.1,
        ratingCount: 80,
      },
      {
        title: "Pizza Hut",
        address: "Av. Anhanguera, 200 - Goiânia - GO",
        phoneNumber: "(62) 3250-2222",
        website: "https://pizzahutgo.com",
        cid: "222",
        rating: 4.4,
        ratingCount: 210,
      },
    ];
    expect(pickBestMapsPlace(places, hut)).toBeNull();
    const listing = resolveGmbListing(places, hut);
    expect(listing.matched).toBe(false);
    expect(listing.status).toBe("candidate");
    expect(listing.cid).toBe("222");
    expect(listing.url).toBe("https://www.google.com/maps?cid=222");
    expect(listing.website_host).toBe("pizzahutgo.com");
    expect(listing.candidates_in_city).toBe(2);
    expect(listing.phone_vs_receita).toBeNull();
    expect(gmbListingCorroborated(listing)).toBe(false);
    expect(domainFromGmb(listing)).toBeNull();
  });

  it("keeps a city pin as a candidate when the Maps title is not the Receita name", () => {
    const input = {
      nomeFantasia: null,
      razaoSocial: "AGROVETERINARIA ARMAZEM DA TERRA LTDA",
      municipio: "Ibirite",
      uf: "MG",
    };
    const places = [
      {
        title: "Agropecuária Central",
        address: "Av. São Paulo, 67 - Ibirité - MG, 32400-000",
        cid: "77",
        rating: 4.7,
        ratingCount: 727,
      },
      {
        title: "Pet Shop Bairro",
        address: "Rua A, 10 - Ibirité - MG",
        cid: "88",
        ratingCount: 12,
      },
    ];
    expect(pickBestMapsPlace(places, input)).toBeNull();
    const picked = pickBestCandidateMapsPlace(places, input);
    expect(picked?.place.cid).toBe("77");
    expect(picked?.count).toBe(2);
    const listing = resolveGmbListing(places, input);
    expect(listing.status).toBe("candidate");
    expect(listing.cid).toBe("77");
    expect(listing.candidates_in_city).toBe(2);
  });

  it("does not suggest an out-of-city pin when nothing correlates", () => {
    const listing = resolveGmbListing(
      [
        {
          title: "Padaria do Centro",
          address: "Belo Horizonte - MG",
          cid: "55",
          ratingCount: 40,
        },
      ],
      {
        nomeFantasia: null,
        razaoSocial: "AGROVETERINARIA ARMAZEM DA TERRA LTDA",
        municipio: "Ibirite",
        uf: "MG",
      },
    );
    expect(listing.status).toBe("none");
    expect(listing.matched).toBe(false);
    expect(listing.cid ?? null).toBeNull();
    expect(listing.url).toContain("google.com/maps/search");
  });

  it("stores a Maps search URL when Serper returns no pin", () => {
    const listing = resolveGmbListing([], {
      nomeFantasia: null,
      razaoSocial: "AGROVETERINARIA ARMAZEM DA TERRA LTDA",
      municipio: "Ibirite",
      uf: "MG",
      logradouro: "Avenida Sao Paulo",
      numero: "67",
    });
    expect(listing.status).toBe("none");
    expect(listing.matched).toBe(false);
    expect(listing.url).toContain("google.com/maps/search");
    expect(decodeURIComponent(listing.url)).toContain(
      "AGROVETERINARIA ARMAZEM DA TERRA",
    );
  });

  it("keeps a unique strong brand on title + city as matched", () => {
    const listing = resolveGmbListing(
      [
        {
          title: "Delpra Pré-Moldados",
          address: "Uberaba - MG",
          website: "https://delpra.net.br",
          cid: "49",
          ratingCount: 49,
        },
      ],
      {
        nomeFantasia: "Delpra Pré-Moldados",
        razaoSocial: "DELPRA PRE MOLDADOS LTDA",
        municipio: "Uberaba",
        uf: "MG",
      },
    );
    expect(listing.matched).toBe(true);
    expect(listing.status).toBe("matched");
    expect(listing.url).toBe("https://www.google.com/maps?cid=49");
    expect(listing.website_host).toBe("delpra.net.br");
    expect(domainFromGmb(listing)).toBe("delpra.net.br");
  });

  it("stores a Maps URL, not the website, on the listing", () => {
    expect(
      mapsPlaceListingUrl({
        title: "Solaris",
        website: "https://solaris.com.br",
        cid: "9",
      }),
    ).toBe("https://www.google.com/maps?cid=9");
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
    expect(card.hours_label).toBe("Monday: 8AM-6PM");
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

  it("does not treat WhatsApp as the company website on the Maps card", () => {
    const card = gmbCardFromPlace({
      title: "Drimafer Máquinas e Equipamentos",
      website: "https://whatsapp.com",
      rating: 5,
      ratingCount: 8,
    });
    expect(card.filled).not.toContain("website");
    expect(card.filled).toContain("reviews");
  });

  it("counts an Instagram profile in the Maps globe without treating it as the company site", () => {
    const place = {
      title: "Vidraçaria Modular",
      website: "https://www.instagram.com/vidracaria.modular/",
      phoneNumber: "(37) 3381-1319",
    };
    const card = gmbCardFromPlace(place);
    const assets = mapsWebsiteAssets(place.website);
    expect(card.filled).toContain("website");
    expect(websiteHostFromMapsPlace(place)).toBeNull();
    expect(assets.websiteHost).toBeNull();
    expect(assets.socials.instagram).toBe("https://instagram.com/vidracaria.modular");
    expect(mapsWebsiteAssets("https://instagram.com").websiteUrl).toBeNull();
  });

  it("copies an Instagram profile from the Maps globe onto empty socials", () => {
    const row = applyMapsWebsiteAssets(
      {
        cnpj: "07997131000134",
        domain: null,
        domain_status: "nao_encontrado",
        http_status: null,
        phones: [],
        emails: [],
        whatsapp: null,
        socials: {},
        tech: {
          metaPixel: false,
          gtm: false,
          ga4: false,
          googleAds: false,
          tiktokPixel: false,
          rdStation: false,
          hotjar: false,
          clarity: false,
          chat: null,
          plataforma: null,
          https: false,
          viewport: false,
        },
        freshness: {},
        osm: null,
        gmb: {
          name: "Vidraçaria Modular",
          url: "https://www.google.com/maps?cid=1",
          matched: true,
          status: "matched",
          website_url: "https://instagram.com/vidracaria.modular",
        },
        dor_digital: 0,
        contexto: [],
        fonte: {},
        midiaPaga: { label: "NÃO VERIFICADO", verificado_automaticamente: false },
        collected_at: "2026-09-07T12:00:00.000Z",
        expires_at: "2026-10-07T12:00:00.000Z",
      },
      "2026-09-07T12:00:00.000Z",
    );
    expect(row.socials.instagram).toBe("https://instagram.com/vidracaria.modular");
    expect(row.fonte.instagram?.fonte).toBe("gmb");
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
        { allowWeakBrand: true },
      ),
    ).toBeNull();
  });

  it("matches a weak handle when the snippet cites the city and a distinctive token", () => {
    const hit = {
      link: "https://instagram.com/vazibirite",
      title: "Vaz (@vazibirite)",
      snippet: "Oficina em Ibirité — MG",
    };
    expect(
      pickSocialHit(
        [hit],
        "instagram.com",
        "VAZ E VAZ METALURGIA LTDA",
        "Metalúrgica Vaz",
        "Ibirité",
      ),
    ).toBeNull();
    expect(
      pickSocialHit(
        [hit],
        "instagram.com",
        "VAZ E VAZ METALURGIA LTDA",
        "Metalúrgica Vaz",
        "Ibirité",
        { allowCitySnippet: true },
      ),
    ).toBe("https://instagram.com/vazibirite");
  });

  it("does not match a random Instagram in the same city", () => {
    expect(
      pickSocialHit(
        [
          {
            link: "https://instagram.com/padariadoCentro",
            title: "Padaria do Centro",
            snippet: "Padaria em Ibirité MG",
          },
        ],
        "instagram.com",
        "VAZ E VAZ METALURGIA LTDA",
        "Metalúrgica Vaz",
        "Ibirité",
        { allowCitySnippet: true },
      ),
    ).toBeNull();
  });

  it("filters geo hits by CEP instead of relaxing the brand", () => {
    expect(
      pickSocialHit(
        [
          {
            link: "https://instagram.com/vazibirite",
            title: "Vaz (@vazibirite)",
            snippet: "Oficina em Ibirité — MG",
          },
        ],
        "instagram.com",
        "VAZ E VAZ METALURGIA LTDA",
        "Metalúrgica Vaz",
        "Ibirité",
        {
          allowCitySnippet: true,
          geo: { cep: "32400000" },
        },
      ),
    ).toBeNull();
    expect(
      pickSocialHit(
        [
          {
            link: "https://instagram.com/vazibirite",
            title: "Vaz (@vazibirite)",
            snippet: "Oficina em Ibirité — 32400-000",
          },
        ],
        "instagram.com",
        "VAZ E VAZ METALURGIA LTDA",
        "Metalúrgica Vaz",
        "Ibirité",
        {
          allowCitySnippet: true,
          geo: { cep: "32400000" },
        },
      ),
    ).toBe("https://instagram.com/vazibirite");
  });
});

describe("searchGmb", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SERPER_API_KEY;
  });

  function mapsFetch(placesByCall: Array<unknown[]>) {
    const queries: string[] = [];
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        try {
          queries.push(
            ((JSON.parse(String(init?.body ?? "")) as { q?: string }).q ?? ""),
          );
        } catch {
          queries.push("");
        }
        const places = placesByCall[queries.length - 1] ?? [];
        return new Response(JSON.stringify({ places }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    return queries;
  }

  it("stops after the first Maps page when a chain is only a city candidate", async () => {
    const queries = mapsFetch([
      [
        {
          title: "Pizza Hut",
          address: "Av. T-63, 100 - Goiânia - GO",
          cid: "111",
          ratingCount: 80,
        },
        {
          title: "Pizza Hut",
          address: "Av. Anhanguera, 200 - Goiânia - GO",
          cid: "222",
          ratingCount: 210,
        },
      ],
      [{ title: "Should not run" }],
    ]);
    const listing = await searchGmb({
      nomeFantasia: "Pizza Hut",
      razaoSocial: "PH GOIANIA ALIMENTOS LTDA",
      municipio: "Goiania",
      uf: "GO",
      logradouro: "Rua do Contador",
      numero: "10",
      phones: [{ ddd: "62", telefone: "40024003" }],
      sharedVerdict: "contabilidade",
    });
    expect(listing.status).toBe("candidate");
    expect(listing.cid).toBe("222");
    expect(queries.length).toBeGreaterThanOrEqual(1);
    expect(queries[0]).toBe('"Pizza Hut" Goiania GO');
  });

  it("does not quote a Receita name with OCR junk", () => {
    const liveIn = {
      nomeFantasia: "LIVE IN A CASA DE IDOS@ FELIZ",
      razaoSocial: "LIVE IN A CASA DE IDOS@ FELIZ LTDA",
      municipio: "Fortaleza",
      uf: "CE",
      logradouro: "Rua Doutor Gilberto Studart",
      numero: "2300",
      phones: [{ ddd: "85", telefone: "89902400" }],
    };
    expect(mapsStructuredQueries(liveIn)[0]).toMatch(/^85\d+ Fortaleza CE$/);
    expect(gmbSearchQueryList(liveIn)[0]).toMatch(/^85\d+ Fortaleza CE$/);
    expect(gmbSearchQueryList(liveIn)).toContain(
      "Rua Doutor Gilberto Studart, 2300 Fortaleza CE",
    );
    expect(gmbSearchQuery(liveIn)).not.toMatch(/IDOS@/);
    expect(gmbSearchQuery(liveIn)).toMatch(/IDOS/);
  });

  it("crava a Maps pin found by phone even when the title is a trading name", async () => {
    const queries = mapsFetch([
      [
        {
          title: "Live In Fortaleza Hotel",
          address: "R. Dr. Gilberto Studart, 2300 - Cocó, Fortaleza - CE",
          phoneNumber: "(85) 98990-2400",
          website: "https://liveinhotel.com.br",
          cid: "99",
          ratingCount: 158,
        },
      ],
    ]);
    const listing = await searchGmb({
      nomeFantasia: "LIVE IN A CASA DE IDOS@ FELIZ",
      razaoSocial: "LIVE IN A CASA DE IDOS@ FELIZ LTDA",
      municipio: "Fortaleza",
      uf: "CE",
      logradouro: "Rua Doutor Gilberto Studart",
      numero: "2300",
      phones: [{ ddd: "85", telefone: "89902400" }],
    });
    expect(queries[0]).toMatch(/Gilberto Studart/);
    expect(listing.matched).toBe(true);
    expect(listing.status).toBe("matched");
    expect(listing.name).toBe("Live In Fortaleza Hotel");
    expect(listing.match_by).toEqual(expect.arrayContaining(["phone"]));
  });

  it("searches the Receita street before the brand so a chain pin can crava", async () => {
    const queries = mapsFetch([
      [
        {
          title: "Pizza Hut",
          address: "Av. Anhanguera, 200 - Goiânia - GO",
          cid: "222",
          ratingCount: 80,
        },
      ],
      [{ title: "Should not run" }],
    ]);
    const listing = await searchGmb({
      nomeFantasia: "Pizza Hut",
      razaoSocial: "PH GOIANIA ALIMENTOS LTDA",
      municipio: "Goiania",
      uf: "GO",
      logradouro: "Av. Anhanguera",
      numero: "200",
      phones: [{ ddd: "62", telefone: "32501111" }],
    });
    expect(queries[0]).toMatch(/Anhanguera/);
    expect(listing.matched).toBe(true);
    expect(listing.cid).toBe("222");
    expect(queries).toHaveLength(1);
  });

  it("finds a unique brand pin on the compact query before the long razão", async () => {
    const pin = {
      title: "Drimafer Máquinas e Equipamentos",
      address: "R. Tupinambás, 1267 - Diadema - SP",
      cid: "17943018822088826880",
      rating: 5,
      ratingCount: 8,
      website: "https://whatsapp.com",
    };
    process.env.SERPER_API_KEY = "test";
    const queries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        let q = "";
        try {
          q = (JSON.parse(String(init?.body ?? "")) as { q?: string }).q ?? "";
        } catch {
          q = "";
        }
        queries.push(q);
        const places = /^drimafer Diadema SP$/i.test(q) ? [pin] : [];
        return new Response(JSON.stringify({ places }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const listing = await searchGmb({
      nomeFantasia: null,
      razaoSocial:
        "DRIMAFER MAQUINAS E EQUIPAMENTOS PARA CONSTRUCAO CIVIL LTDA",
      municipio: "Diadema",
      uf: "SP",
      logradouro: "Rua Tupinambas",
      numero: "1267",
      cep: "09991090",
      receitaEmail: "marcia@drimafer.com.br",
    });
    expect(queries).toContain("drimafer Diadema SP");
    expect(listing.matched).toBe(true);
    expect(listing.name).toBe("Drimafer Máquinas e Equipamentos");
    expect(listing.website_host).toBeNull();
    expect(listing.card?.filled).not.toContain("website");
  });

  it("matches a trading-name Maps card via the compact brand query", async () => {
    const futuraPlace = {
      title: "Futura Imobiliária",
      address: "R. dos Estudantes, 101 - Viçosa - MG",
      phoneNumber: "(31) 3892-4111",
      cid: "9",
      rating: 4.7,
      ratingCount: 95,
      thumbnailUrl: "https://img.test/pin.jpg",
      website: "https://futuraimobiliaria.com.br",
      openingHours: ["seg 08:00"],
    };
    process.env.SERPER_API_KEY = "test";
    const queries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        let q = "";
        try {
          q = (JSON.parse(String(init?.body ?? "")) as { q?: string }).q ?? "";
        } catch {
          q = "";
        }
        queries.push(q);
        const places =
          /futura/i.test(q) && !/empreendimentos/i.test(q) ? [futuraPlace] : [];
        return new Response(JSON.stringify({ places }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const listing = await searchGmb({
      nomeFantasia: "FUTURA EMPREENDIMENTOS E NEGOCIOS IMOBILIARIOS",
      razaoSocial: "FUTURA EMPREENDIMENTOS E NEGOCIOS IMOBILIARIOS LTDA",
      municipio: "Vicosa",
      uf: "MG",
      phones: [{ ddd: "31", telefone: "38924111" }],
    });
    expect(listing.matched).toBe(true);
    expect(listing.name).toBe("Futura Imobiliária");
    expect(listing.card?.rating).toBe(4.7);
    expect(listing.card?.ratingCount).toBe(95);
    expect(listing.card?.score).toBe(5);
    expect(queries.some((q) => /futura/i.test(q) && !/empreendimentos/i.test(q))).toBe(
      true,
    );
  });

  it("matches Vidraçaria Modular from the CNAE trade query, not the legal name", async () => {
    const pin = {
      title: "Vidraçaria Modular",
      address: "R. Rio São Francisco, 135 - Serra verde, Cláudio - MG",
      phoneNumber: "(37) 9122-1383",
      cid: "88",
      rating: 4,
      ratingCount: 2,
      thumbnailUrl: "https://img.test/vidro.jpg",
    };
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        let q = "";
        try {
          q = (JSON.parse(String(init?.body ?? "")) as { q?: string }).q ?? "";
        } catch {
          q = "";
        }
        const hit = /vidra/i.test(q) && /modular/i.test(q);
        return new Response(JSON.stringify({ places: hit ? [pin] : [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const listing = await searchGmb({
      nomeFantasia: "MODULAR SOLUCOES",
      razaoSocial: "MODULAR SOLUCOES LTDA",
      municipio: "Claudio",
      uf: "MG",
      cnaeDescricao: "Comércio varejista de vidros",
    });
    expect(listing.matched).toBe(true);
    expect(listing.name).toBe("Vidraçaria Modular");
    expect(listing.cid).toBe("88");
  });

  it("returns a Maps search URL when every query misses", async () => {
    mapsFetch([[], [], [], [], [], [], []]);
    const listing = await searchGmb({
      nomeFantasia: null,
      razaoSocial: "AGROVETERINARIA ARMAZEM DA TERRA LTDA",
      municipio: "Ibirite",
      uf: "MG",
      logradouro: "Avenida Sao Paulo",
      numero: "67",
    });
    expect(listing.status).toBe("none");
    expect(listing.url).toContain("google.com/maps/search");
  });

  it("does not search a landline-only digits query when city tokens hide the listing", async () => {
    const pin = {
      title: "Santa Tereza Pilates & Funcional",
      address: "R. Mármore, 196 - Santa Tereza, Belo Horizonte - MG",
      phoneNumber: "(31) 2555-5527",
      website: "https://santaterezapilates.com.br",
      cid: "55",
      rating: 4.7,
      ratingCount: 27,
      openingHours: ["Fecha 21:30"],
      thumbnailUrl: "https://img.test/studio.jpg",
      category: "Estúdio de pilates",
    };
    process.env.SERPER_API_KEY = "test";
    const queries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        let q = "";
        try {
          q = (JSON.parse(String(init?.body ?? "")) as { q?: string }).q ?? "";
        } catch {
          q = "";
        }
        queries.push(q);
        const places = q === "3125555527" ? [pin] : [];
        return new Response(JSON.stringify({ places }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const listing = await searchGmb({
      nomeFantasia: "STUDIO SANTA TEREZA",
      razaoSocial: "STUDIO SANTA TEREZA LTDA",
      municipio: "Belo Horizonte",
      uf: "MG",
      logradouro: "Rua Marmore",
      numero: "196",
      phones: [{ ddd: "31", telefone: "25555527" }],
    });
    expect(queries[0]).toBe("Rua Marmore, 196 Belo Horizonte MG");
    expect(queries[1]).toMatch(/santa tereza/i);
    expect(queries.some((q) => /3125555527/.test(q))).toBe(false);
    expect(listing.matched).toBe(false);
  });

  it("opens the Maps miss on the quoted company name, not the Receita phone", async () => {
    mapsFetch([[], [], [], [], [], [], [], [], [], [], []]);
    const listing = await searchGmb({
      nomeFantasia: "STUDIO SANTA TEREZA",
      razaoSocial: "STUDIO SANTA TEREZA LTDA",
      municipio: "Belo Horizonte",
      uf: "MG",
      phones: [{ ddd: "31", telefone: "25555527" }],
    });
    expect(listing.status).toBe("none");
    expect(decodeURIComponent(listing.url)).toContain('"STUDIO SANTA TEREZA"');
    expect(decodeURIComponent(listing.url)).not.toContain("3125555527");
  });

  it("hydrates a human-inserted cid into the public Maps card", async () => {
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            places: [
              {
                title: "Santa Tereza Pilates & Funcional",
                phoneNumber: "(31) 2555-5527",
                website: "https://santaterezapilates.com.br",
                cid: "55",
                rating: 4.7,
                ratingCount: 27,
                openingHours: ["Fecha 21:30"],
                thumbnailUrl: "https://img.test/studio.jpg",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    const inserted = {
      name: "Santa Tereza Pilates & Funcional",
      url: "https://www.google.com/maps?cid=55",
      matched: true,
      status: "matched" as const,
      cid: "55",
    };
    expect(gmbListingNeedsHydration(inserted)).toBe(true);
    const hydrated = await hydrateMatchedGmbListing(inserted);
    expect(hydrated.card?.score).toBe(5);
    expect(hydrated.website_host).toBe("santaterezapilates.com.br");
    expect(hydrated.website_url).toContain("santaterezapilates.com.br");
    expect(hydrated.phone_e164).toBe("+553125555527");
    expect(
      mergeMapsPlaceOntoListing(inserted, {
        title: "Santa Tereza Pilates & Funcional",
        website: "https://santaterezapilates.com.br",
        phoneNumber: "(31) 2555-5527",
        cid: "55",
      }).website_host,
    ).toBe("santaterezapilates.com.br");
  });

  it("rehydrates a pin that already has a card to pick up an Instagram globe", async () => {
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            places: [
              {
                title: "Vidraçaria Modular",
                website: "https://www.instagram.com/vidracaria.modular/",
                phoneNumber: "(37) 3381-1319",
                address: "R. Rio São Francisco, 135 - Cláudio - MG",
                cid: "7",
                rating: 4,
                ratingCount: 2,
                openingHours: ["Fecha terça 07:30"],
                thumbnailUrl: "https://img.test/m.jpg",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    const hydrated = await hydrateMatchedGmbListing(
      {
        name: "MODULAR SOLUCOES",
        url: "https://www.google.com/maps?cid=7",
        matched: true,
        status: "matched",
        cid: "7",
        card: {
          filled: ["phone"],
          score: 1,
          rating: null,
          ratingCount: 0,
          category: null,
        },
      },
      undefined,
      { force: true },
    );
    expect(hydrated.website_url).toBe("https://instagram.com/vidracaria.modular");
    expect(hydrated.website_host).toBeNull();
    expect(hydrated.card?.filled).toContain("website");
    expect(hydrated.address).toMatch(/Rio São Francisco/);
  });

  it("retries the cid lookup once before giving up", async () => {
    const queries = mapsFetch([
      [],
      [
        {
          title: "Usinagem Paulo Monteiro",
          phoneNumber: "(31) 3351-6431",
          website: "https://usipam.com.br",
          cid: "1",
          rating: 4.9,
          ratingCount: 16,
          thumbnailUrl: "https://img.test/u.jpg",
        },
      ],
    ]);
    const hydrated = await hydrateMatchedGmbListing({
      name: "Usinagem Paulo Monteiro",
      url: "https://www.google.com/maps?cid=1",
      matched: true,
      status: "matched",
      cid: "1",
    });
    expect(queries).toEqual([
      "https://www.google.com/maps?cid=1",
      "https://www.google.com/maps?cid=1",
    ]);
    expect(hydrated.card?.filled).toEqual(
      expect.arrayContaining(["phone", "website", "photo", "reviews"]),
    );
    expect(hydrated.card?.ratingCount).toBe(16);
  });

  it("falls back to the pin name when the cid lookup is empty", async () => {
    const queries = mapsFetch([
      [],
      [],
      [
        {
          title: "Usinagem Paulo Monteiro",
          phoneNumber: "(31) 3351-6431",
          website: "https://usipam.com.br",
          cid: "9",
          rating: 4.9,
          ratingCount: 16,
        },
      ],
    ]);
    const hydrated = await hydrateMatchedGmbListing({
      name: "Usinagem Paulo Monteiro",
      url: "https://www.google.com/maps?cid=1",
      matched: true,
      status: "matched",
      cid: "1",
    });
    expect(queries).toHaveLength(2);
    expect(queries[0]).toBe("https://www.google.com/maps?cid=1");
    expect(hydrated.card).toBeUndefined();
    expect(hydrated.cid).toBe("1");
  });

  it("builds name + município + UF queries after the cid URL", () => {
    expect(
      gmbHydrationQueries(
        {
          name: "Usinagem Paulo Monteiro",
          url: "https://www.google.com/maps?cid=1",
          matched: true,
          status: "matched",
          cid: "1",
        },
        { municipio: "Contagem", uf: "MG" },
      ),
    ).toEqual([
      "https://www.google.com/maps?cid=1",
      '"Usinagem Paulo Monteiro" Contagem MG',
      "Usinagem Paulo Monteiro Contagem MG",
      "Usinagem Paulo Monteiro",
    ]);
  });

  it("tries Receita fantasia + city before the Maps pin title", () => {
    expect(
      gmbHydrationQueries(
        {
          name: "Usinagem Paulo Monteiro",
          url: "https://www.google.com/maps?cid=1",
          matched: true,
          status: "matched",
          cid: "1",
        },
        {
          municipio: "CONTAGEM",
          uf: "MG",
          extraNames: ["USIPAM", "USINAGEM PAULO MONTEIRO LTDA"],
        },
      )[1],
    ).toBe('"USIPAM" CONTAGEM MG');
  });

  it("falls back to quoted name + city + UF when the cid lookup is empty", async () => {
    const queries = mapsFetch([
      [],
      [],
      [
        {
          title: "Usinagem Paulo Monteiro",
          phoneNumber: "(31) 3351-6431",
          website: "https://usipam.com.br",
          cid: "9",
          rating: 4.9,
          ratingCount: 16,
        },
      ],
    ]);
    const hydrated = await hydrateMatchedGmbListing(
      {
        name: "Usinagem Paulo Monteiro",
        url: "https://www.google.com/maps?cid=1",
        matched: true,
        status: "matched",
        cid: "1",
      },
      { municipio: "Contagem", uf: "MG" },
    );
    expect(queries).toEqual([
      "https://www.google.com/maps?cid=1",
      "https://www.google.com/maps?cid=1",
    ]);
    expect(hydrated.card).toBeUndefined();
    expect(hydrated.cid).toBe("1");
  });

  it("hydrates a matched pin that has a name but no cid", async () => {
    expect(
      gmbListingNeedsHydration({
        name: "Usinagem Paulo Monteiro",
        url: "https://maps.app.goo.gl/abc",
        matched: true,
        status: "matched",
      }),
    ).toBe(true);
    mapsFetch([
      [
        {
          title: "Usinagem Paulo Monteiro",
          phoneNumber: "(31) 3351-6431",
          cid: "77",
        },
      ],
    ]);
    const hydrated = await hydrateMatchedGmbListing({
      name: "Usinagem Paulo Monteiro",
      url: "https://maps.app.goo.gl/abc",
      matched: true,
      status: "matched",
    });
    expect(hydrated.card?.filled).toContain("phone");
    expect(hydrated.cid).toBe("77");
  });

  it("keeps card null when Serper returns no place", async () => {
    mapsFetch([[], [], []]);
    const inserted = {
      name: "Usinagem Paulo Monteiro",
      url: "https://www.google.com/maps?cid=1",
      matched: true,
      status: "matched" as const,
      cid: "1",
    };
    const hydrated = await hydrateMatchedGmbListing(inserted);
    expect(hydrated.card).toBeUndefined();
    expect(hydrated.cid).toBe("1");
  });
});

describe("preferGmbListing", () => {
  it("upgrades a miss to a matched trading-name card", () => {
    const next = resolveGmbListing(
      [
        {
          title: "Futura Imobiliária",
          address: "Centro, Vicosa - MG",
          cid: "9",
          rating: 4.7,
          ratingCount: 95,
        },
      ],
      {
        nomeFantasia: "Futura Imobiliária",
        razaoSocial: "FUTURA EMPREENDIMENTOS E NEGOCIOS IMOBILIARIOS LTDA",
        municipio: "Vicosa",
        uf: "MG",
      },
    );
    expect(next.matched).toBe(true);
    const chosen = preferGmbListing(
      { name: "", url: "", matched: false, status: "none" },
      next,
    );
    expect(chosen).toBe(next);
  });
});

describe("instagramSearchQueries", () => {
  it("picks one Instagram query: quoted site search", () => {
    const queries = instagramSearchQueries({
      nomeFantasia: "Loires Tecnologia",
      razaoSocial: "LOIRES INFORMATICA LTDA",
      municipio: "Campo Grande",
      uf: "MS",
      cep: "79004290",
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]?.q).toBe('site:instagram.com "Loires Tecnologia"');
  });

  it("only geo-anchors a weak brand", () => {
    const queries = instagramSearchQueries({
      nomeFantasia: "DISTRIBUIDORA SILVA",
      razaoSocial: "SILVA'S DISTRIBUIDORA DE PECAS AUTOMOTIVAS LTDA",
      municipio: "Contagem",
      uf: "MG",
      cep: "30130100",
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]?.q).toBe('site:instagram.com "DISTRIBUIDORA SILVA"');
  });

  it("searches Instagram by the confirmed site host before the Receita name", () => {
    const queries = instagramSearchQueries({
      nomeFantasia: "LIVE IN A CASA DE IDOS@ FELIZ",
      razaoSocial: "LIVE IN A CASA DE IDOS@ FELIZ LTDA",
      municipio: "Fortaleza",
      uf: "CE",
      websiteHost: "liveinhotel.com.br",
      brandOverride: "Live In Fortaleza Hotel",
    });
    expect(queries[0]?.q).toBe("site:instagram.com liveinhotel");
    expect(queries.map((item) => item.q).join(" ")).not.toMatch(/IDOS@/);
  });
});

describe("searchInstagramProfile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SERPER_API_KEY;
  });

  it("returns Instagram candidates when no hit is clear", async () => {
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            organic: [
              {
                link: "https://www.instagram.com/vazibirite/",
                title: "Vaz Ibirité (@vazibirite)",
              },
              {
                link: "https://www.instagram.com/vazoficial/",
                title: "Vaz Oficial (@vazoficial)",
              },
              {
                link: "https://www.instagram.com/padariadoCentro/",
                title: "Padaria do Centro",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    const found = await searchInstagramProfile({
      nomeFantasia: "Metalúrgica Vaz",
      razaoSocial: "VAZ E VAZ METALURGIA LTDA",
      municipio: "Contagem",
      uf: "MG",
    });
    expect(found.url).toBeNull();
    expect(found.candidates.map((item) => item.url)).toEqual([
      "https://instagram.com/vazibirite",
      "https://instagram.com/vazoficial",
    ]);
  });

  it("keeps a personal mention as a candidate instead of auto-attaching", async () => {
    process.env.SERPER_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            organic: [
              {
                link: "https://www.instagram.com/pvdlacoste9/",
                title: "pvdlacoste9 (@pvdlacoste9)",
                snippet:
                  "Conheci Doces Aritana em Caeté — #DocesAritana #MinasGerais",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    const found = await searchInstagramProfile({
      nomeFantasia: "Doces Aritana",
      razaoSocial: "DOCES ARITANA LTDA",
      municipio: "Caete",
      uf: "MG",
    });
    expect(found.url).toBeNull();
    expect(found.candidates.map((item) => item.url)).toEqual([
      "https://instagram.com/pvdlacoste9",
    ]);
  });
});

describe("maps CEP and website lock", () => {
  it("matches a Maps pin by CEP + title", () => {
    expect(
      mapsCepMatchesReceita(
        "R. Calarge, 508 - Campo Grande - MS, 79004-290",
        "79004290",
      ),
    ).toBe(true);
    const scored = scoreMapsPlace(
      {
        title: "Loires Tecnologia & Sistemas",
        address: "R. Calarge, 508 - Campo Grande - MS, 79004-290",
        website: "https://loires.com.br",
      },
      {
        nomeFantasia: "LOIRES INFORMATICA",
        razaoSocial: "LOIRES INFORMATICA LTDA",
        municipio: "Campo Grande",
        uf: "MS",
        cep: "79004290",
        websiteHost: "loires.com.br",
      },
    );
    expect(scored.matched).toBe(true);
    expect(scored.match_by).toEqual(
      expect.arrayContaining(["title", "cep", "website"]),
    );
  });

  it("does not upgrade a franchise candidate by shared website", () => {
    const upgraded = upgradeGmbWithWebsite(
      {
        name: "Pizza Hut",
        url: "https://www.google.com/maps?cid=1",
        matched: false,
        status: "candidate",
        website_host: "pizzahut.com.br",
        match_by: ["title", "city"],
        candidates_in_city: 3,
      },
      "pizzahut.com.br",
    );
    expect(upgraded?.matched).toBe(false);
    expect(upgraded?.status).toBe("candidate");
  });

  it("upgrades a unique candidate when the Maps website is the confirmed host", () => {
    const upgraded = upgradeGmbWithWebsite(
      {
        name: "Loires Tecnologia & Sistemas",
        url: "https://www.google.com/maps?cid=9",
        matched: false,
        status: "candidate",
        website_host: "loires.com.br",
        match_by: ["title", "city"],
        candidates_in_city: 1,
      },
      "loires.com.br",
    );
    expect(upgraded?.matched).toBe(true);
    expect(upgraded?.match_by).toContain("website");
  });
});

