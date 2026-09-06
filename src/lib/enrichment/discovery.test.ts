import { describe, expect, it } from "vitest";
import {
  DOMAIN_DISCOVERY_VERSION,
  humanClearedDomain,
  humanClearedMaps,
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

  it("retries a Maps miss even when the site was already found", () => {
    expect(
      needsDiscoveryRetry(
        row({
          domain: "pizzahutgo.com",
          domain_status: "nao_confirmado",
          gmb: { name: "", url: "", matched: false, status: "none" },
          fonte: {
            discovery: {
              fonte: "5",
              coletado_em: "2026-09-01T00:00:00.000Z",
            },
          },
        }),
      ),
    ).toBe(true);
  });

  it("does not loop a Maps miss after the current discovery version already ran", () => {
    expect(
      needsDiscoveryRetry(
        row({
          domain: "pizzahutgo.com",
          domain_status: "nao_confirmado",
          gmb: { name: "", url: "", matched: false, status: "none" },
          fonte: {
            discovery: {
              fonte: DOMAIN_DISCOVERY_VERSION,
              coletado_em: "2026-09-06T00:00:00.000Z",
            },
          },
        }),
      ),
    ).toBe(false);
  });

  it("does not override a Maps pin the human removed", () => {
    const cleared = row({
      domain: "exemplo.com.br",
      domain_status: "nao_confirmado",
      gmb: { name: "", url: "", matched: false, status: "none" },
      fonte: {
        discovery: {
          fonte: "5",
          coletado_em: "2026-09-01T00:00:00.000Z",
        },
        gmb: { fonte: "human", coletado_em: "2026-09-05T00:00:00.000Z" },
      },
    });
    expect(humanClearedMaps(cleared)).toBe(true);
    expect(needsDiscoveryRetry(cleared)).toBe(false);
  });

  it("does not re-qualify a matched Maps pin just because discovery rules bumped", () => {
    expect(
      needsDiscoveryRetry(
        row({
          domain: "exemplo.com.br",
          domain_status: "nao_confirmado",
          gmb: {
            name: "Exemplo",
            url: "https://www.google.com/maps?cid=1",
            matched: true,
            status: "matched",
          },
          fonte: {
            discovery: {
              fonte: "5",
              coletado_em: "2026-09-01T00:00:00.000Z",
            },
          },
        }),
      ),
    ).toBe(false);
  });
});
