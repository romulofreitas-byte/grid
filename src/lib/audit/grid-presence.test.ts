import { describe, expect, it } from "vitest";
import { gridPresenceFromEnrichment, GRID_PRESENCE_GRID_IDS } from "./grid-presence";
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

function enrichment(partial: Partial<LeadEnrichment> = {}): LeadEnrichment {
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

describe("GRID_PRESENCE_GRID_IDS", () => {
  it("keeps four scannable marks for the results grid", () => {
    expect([...GRID_PRESENCE_GRID_IDS]).toEqual([
      "site",
      "instagram",
      "maps",
      "whatsapp",
    ]);
  });
});

describe("gridPresenceFromEnrichment", () => {
  it("returns nothing without enrichment", () => {
    expect(gridPresenceFromEnrichment(null)).toEqual([]);
    expect(gridPresenceFromEnrichment(undefined)).toEqual([]);
  });

  it("includes a live site with its URL", () => {
    const assets = gridPresenceFromEnrichment(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        http_status: 200,
      }),
    );
    expect(assets).toEqual([
      { id: "site", href: "https://exemplo.com.br", unverified: false },
    ]);
  });

  it("includes a Serper Instagram candidate as unverified", () => {
    const assets = gridPresenceFromEnrichment(
      enrichment({
        domain: null,
        domain_status: "nao_encontrado",
        socials: { instagram: "https://instagram.com/colegiogenesis" },
        fonte: {
          instagram: { fonte: "serper", coletado_em: "2026-08-19T12:00:00.000Z" },
        },
      }),
    );
    expect(assets).toEqual([
      {
        id: "instagram",
        href: "https://instagram.com/colegiogenesis",
        unverified: true,
      },
    ]);
  });

  it("keeps a Maps candidate pin and skips a Maps miss with only a search URL", () => {
    const candidate = gridPresenceFromEnrichment(
      enrichment({
        gmb: {
          name: "Pizza Hut",
          url: "https://www.google.com/maps?cid=222",
          matched: false,
          status: "candidate",
          cid: "222",
          match_by: ["title", "city"],
          candidates_in_city: 2,
          card: {
            filled: ["phone", "website", "reviews"],
            score: 3,
            rating: 4.4,
            ratingCount: 210,
            category: "Pizza restaurant",
          },
        },
        fonte: {
          gmb: { fonte: "serper", coletado_em: "2026-09-05T12:00:00.000Z" },
        },
      }),
    );
    expect(candidate.map((a) => a.id)).toEqual(["maps", "gmb"]);
    expect(candidate.every((a) => a.unverified)).toBe(true);
    expect(candidate.every((a) => a.href.includes("cid=222"))).toBe(true);

    const miss = gridPresenceFromEnrichment(
      enrichment({
        gmb: {
          name: "",
          url: "https://www.google.com/maps/search/?api=1&query=%22Armazem%22",
          matched: false,
          status: "none",
        },
        fonte: {
          gmb: { fonte: "serper", coletado_em: "2026-09-05T12:00:00.000Z" },
        },
      }),
    );
    expect(miss.map((a) => a.id)).not.toContain("maps");
    expect(miss.map((a) => a.id)).not.toContain("gmb");
  });

  it("omits gaps — confirmed site with no Instagram stays off the grid", () => {
    const assets = gridPresenceFromEnrichment(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        http_status: 200,
        socials: {},
      }),
    );
    expect(assets.map((a) => a.id)).toEqual(["site"]);
  });
});
