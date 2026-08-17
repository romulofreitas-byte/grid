import { describe, expect, it } from "vitest";
import { isEnrichmentComplete, isEnrichmentVisible } from "./fresh";
import type { LeadEnrichment, TechSignals } from "@/lib/types";

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

function row(partial: Partial<LeadEnrichment> = {}): LeadEnrichment {
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

describe("enrichment freshness", () => {
  it("treats a partial stage as visible but not complete", () => {
    const partial = row({ stage: "home", domain: "exemplo.com.br" });
    expect(isEnrichmentVisible(partial)).toBe(true);
    expect(isEnrichmentComplete(partial)).toBe(false);
  });

  it("treats a legacy row without stage as complete", () => {
    expect(isEnrichmentComplete(row())).toBe(true);
  });

  it("rejects an expired complete row", () => {
    expect(
      isEnrichmentComplete(row({ expires_at: "2020-01-01T00:00:00.000Z" })),
    ).toBe(false);
    expect(
      isEnrichmentVisible(row({ expires_at: "2020-01-01T00:00:00.000Z" })),
    ).toBe(false);
  });
});
