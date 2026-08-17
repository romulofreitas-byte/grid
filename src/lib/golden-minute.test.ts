import { describe, expect, it } from "vitest";
import { buildGoldenMinute, GOLDEN_MINUTE_PLACEHOLDER } from "./golden-minute";
import type { LeadEnrichment, TechSignals } from "./types";

const emptyTech: TechSignals = {
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
  https: true,
  viewport: true,
};

function enrichment(partial: Partial<LeadEnrichment>): LeadEnrichment {
  return {
    cnpj: "00000000000000",
    domain: null,
    domain_status: "nao_encontrado",
    http_status: null,
    phones: [],
    emails: [],
    whatsapp: null,
    socials: {},
    tech: emptyTech,
    freshness: {},
    osm: null,
    dor_digital: 0,
    contexto: [],
    fonte: {},
    midiaPaga: { label: "NÃO VERIFICADO", verificado_automaticamente: false },
    collected_at: "2026-08-13T12:00:00.000Z",
    expires_at: "2026-09-12T12:00:00.000Z",
    ...partial,
  };
}

describe("buildGoldenMinute", () => {
  it("keeps the placeholder when there are fewer than 2 facts", () => {
    const r = buildGoldenMinute(
      enrichment({
        domain_status: "nao_confirmado",
        domain: "exemplo.com.br",
      }),
    );
    expect(r.insufficient).toBe(true);
    expect(r.contexto).toBe(GOLDEN_MINUTE_PLACEHOLDER);
  });

  it("joins observed facts without inventing copy", () => {
    const r = buildGoldenMinute(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        http_status: 200,
        tech: emptyTech,
        socials: {},
        whatsapp: null,
      }),
    );
    expect(r.insufficient).toBe(false);
    expect(r.facts.length).toBeGreaterThanOrEqual(2);
    expect(r.contexto).not.toBe(GOLDEN_MINUTE_PLACEHOLDER);
  });

  it("uses the market bridge phrase instead of the tool gap", () => {
    const r = buildGoldenMinute(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        http_status: 200,
        tech: emptyTech,
        socials: {},
        whatsapp: null,
      }),
      {
        slug: "oticas",
        nome: "ótica",
        dorPrincipal: "dependem da calçada",
        dorChip: "Calçada e médico",
        perguntaConsideracao: "Como está isso aí?",
        sazonalidade: null,
        sazonalidadeChip: null,
        janelaHorario: "de manhã",
        pontePorSinal: {
          "sem-instagram":
            "sem ação ativa, a ótica fica na calçada e na indicação do médico",
          "sem-mensuracao":
            "sem medir o que entra, a ótica não vê se a calçada ainda paga a conta",
          "sem-whatsapp": "sem WhatsApp, o lead pede preço no concorrente",
        },
      },
    );
    expect(r.facts.some((f) => f.phrase.includes("calçada"))).toBe(true);
    expect(r.contexto).not.toMatch(/ferramenta de mensuração/i);
  });
});
