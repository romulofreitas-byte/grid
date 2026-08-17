import { describe, expect, it } from "vitest";
import { buildArrivalTrail, liveArrivalLine } from "./arrival";
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
    domain: "exemplo.com.br",
    domain_status: "confirmado",
    http_status: 200,
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
    stage: "home",
    ...partial,
  };
}

describe("buildArrivalTrail", () => {
  it("marks the queue live while waiting for the first slice", () => {
    const steps = buildArrivalTrail(null, true);
    expect(steps[0]?.status).toBe("live");
    expect(steps[1]?.status).toBe("live");
  });

  it("lights home as done and site as live after the homepage slice", () => {
    const steps = buildArrivalTrail(row({ stage: "home" }), true);
    expect(steps.find((s) => s.id === "domain")?.status).toBe("done");
    expect(steps.find((s) => s.id === "home")?.status).toBe("done");
    expect(steps.find((s) => s.id === "site")?.status).toBe("live");
  });

  it("returns a single live line for the compact trail", () => {
    expect(liveArrivalLine(null, true)).toBe("buscando site");
    expect(liveArrivalLine(row({ stage: "home" }), true)).toBe(
      "procurando nomes no site",
    );
    expect(liveArrivalLine(row({ stage: "complete" }), false)).toBeNull();
  });
});
