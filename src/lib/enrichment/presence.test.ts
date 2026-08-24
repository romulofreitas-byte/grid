import { describe, expect, it } from "vitest";
import { presenceBrandTokens } from "./confirm-domain";
import {
  pickBestDomainHit,
  pickSocialHit,
  presenceQuery,
  scoreDomainHit,
  socialHitMatchesBrand,
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
