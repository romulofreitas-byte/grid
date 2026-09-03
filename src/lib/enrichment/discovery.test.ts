import { describe, expect, it } from "vitest";
import {
  DOMAIN_DISCOVERY_VERSION,
  humanClearedDomain,
  needsDiscoveryRetry,
} from "./discovery";
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
    cnpj: "03658515001062",
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
    stage: "complete",
    collected_at: "2026-08-13T12:00:00.000Z",
    expires_at: "2026-12-12T12:00:00.000Z",
    ...partial,
  };
}

describe("needsDiscoveryRetry", () => {
  it("retries a complete miss from the previous discovery rules", () => {
    expect(
      needsDiscoveryRetry(
        row({
          fonte: {
            discovery: {
              fonte: "3",
              coletado_em: "2026-09-01T00:00:00.000Z",
            },
          },
        }),
      ),
    ).toBe(true);
    expect(needsDiscoveryRetry(row())).toBe(true);
  });

  it("does not loop after the current discovery version already ran", () => {
    expect(
      needsDiscoveryRetry(
        row({
          fonte: {
            discovery: {
              fonte: DOMAIN_DISCOVERY_VERSION,
              coletado_em: "2026-09-02T00:00:00.000Z",
            },
          },
        }),
      ),
    ).toBe(false);
  });

  it("retries a directory host that was stored as the company site", () => {
    expect(
      needsDiscoveryRetry(
        row({
          domain: "escolasbrasil.org",
          domain_status: "confirmado",
        }),
      ),
    ).toBe(true);
  });

  it("does not override a site the human removed", () => {
    const cleared = row({
      fonte: {
        domain: { fonte: "human", coletado_em: "2026-09-02T00:00:00.000Z" },
      },
    });
    expect(humanClearedDomain(cleared)).toBe(true);
    expect(needsDiscoveryRetry(cleared)).toBe(false);
  });
});
