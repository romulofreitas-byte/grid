import { describe, expect, it } from "vitest";
import { computeDorDigital } from "./scoring";
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
  chat: "whatsapp",
  plataforma: null,
  https: true,
  viewport: true,
};

function enrichment(partial: Partial<LeadEnrichment>): LeadEnrichment {
  return {
    cnpj: "00000000000000",
    domain: "exemplo.com.br",
    domain_status: "confirmado",
    http_status: 200,
    phones: [],
    emails: [],
    whatsapp: "5511999999999",
    socials: { instagram: "https://instagram.com/exemplo" },
    tech: { ...emptyTech, metaPixel: true, gtm: true, googleAds: true },
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

describe("computeDorDigital GMB", () => {
  it("does not score legacy rows without a GMB scan", () => {
    expect(computeDorDigital("b2c_local", enrichment({}))).toBe(0);
  });

  it("adds pain when the listing is missing or the card is thin", () => {
    expect(
      computeDorDigital(
        "b2c_local",
        enrichment({ gmb: { name: "", url: "", matched: false } }),
      ),
    ).toBe(6);
    expect(
      computeDorDigital(
        "b2c_local",
        enrichment({
          gmb: {
            name: "Exemplo",
            url: "https://maps.google.com/?cid=1",
            matched: true,
            card: {
              filled: ["phone"],
              score: 1,
              rating: null,
              ratingCount: 0,
              category: null,
            },
          },
        }),
      ),
    ).toBe(4);
  });
});
