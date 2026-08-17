import { describe, expect, it } from "vitest";
import { contactsFromEnrichmentPhones, overlayGridPhone } from "./grid-phone";
import type { LeadEnrichment, PhoneEvidence } from "./types";

function phone(partial: Partial<PhoneEvidence> & Pick<PhoneEvidence, "e164" | "seal">): PhoneEvidence {
  return {
    display: partial.e164,
    tipo: "fixo",
    sources: ["receita"],
    isWhatsApp: false,
    sharedCount: 1,
    sharedVerdict: "proprio",
    ...partial,
  };
}

const enrichment = (phones: PhoneEvidence[]): LeadEnrichment =>
  ({
    cnpj: "00000000000000",
    domain: "exemplo.com.br",
    domain_status: "confirmado",
    http_status: 200,
    phones,
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
      https: true,
      viewport: true,
    },
    freshness: {},
    osm: null,
    dor_digital: 0,
    contexto: [],
    fonte: {},
    midiaPaga: { label: "NÃO VERIFICADO", verificado_automaticamente: false },
    collected_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  }) as LeadEnrichment;

describe("overlayGridPhone", () => {
  it("keeps Receita when there is no audit", () => {
    const row = {
      telefone: "3133334444",
      seal: "COMPARTILHADO" as const,
      sharedCount: 335,
      sharedVerdict: "contabilidade" as const,
    };
    expect(overlayGridPhone(row, null)).toEqual(row);
  });

  it("demotes Grupo to Contabilidade for every cluster above 50, not only 335", () => {
    const row = {
      telefone: "3133334444",
      seal: "GRUPO" as const,
      sharedCount: 116,
      sharedVerdict: "grupo_economico" as const,
    };
    expect(overlayGridPhone(row, null)).toEqual({
      ...row,
      seal: "COMPARTILHADO",
      sharedVerdict: "contabilidade",
    });
  });

  it("keeps Grupo inside the 50-company cap", () => {
    const row = {
      telefone: "3133334444",
      seal: "GRUPO" as const,
      sharedCount: 40,
      sharedVerdict: "grupo_economico" as const,
    };
    expect(overlayGridPhone(row, null)).toEqual(row);
  });

  it("promotes the site number when audit finds a different phone", () => {
    const row = {
      telefone: "3133334444",
      seal: "COMPARTILHADO" as const,
      sharedCount: 335,
      sharedVerdict: "contabilidade" as const,
    };
    const next = overlayGridPhone(
      row,
      enrichment([
        phone({
          e164: "+5531988887777",
          tipo: "movel",
          sources: ["site_tel"],
          seal: "ATUALIZADO",
          sharedCount: 1,
          sharedVerdict: "proprio",
        }),
      ]),
    );
    expect(next.telefone).toBe("31988887777");
    expect(next.seal).toBe("ATUALIZADO");
    expect(next.sharedCount).toBe(1);
  });
});

describe("contactsFromEnrichmentPhones", () => {
  it("drops OSM-only numbers", () => {
    const list = contactsFromEnrichmentPhones([
      phone({ e164: "+553133334444", sources: ["osm"], seal: "NAO_CONFIRMADO" }),
      phone({ e164: "+5531988887777", sources: ["site_tel"], seal: "ATUALIZADO" }),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe("site");
    expect(list[0]?.telefone).toBe("988887777");
  });

  it("does not throw on phones missing sources or e164", () => {
    const broken = [
      { seal: "NAO_CONFIRMADO" },
      { e164: "+553133334444", seal: "NAO_CONFIRMADO" },
    ] as PhoneEvidence[];
    expect(() => contactsFromEnrichmentPhones(broken)).not.toThrow();
    expect(contactsFromEnrichmentPhones(broken)).toEqual([]);
  });
});

describe("overlayGridPhone malformed audit", () => {
  const row = {
    telefone: "3133334444",
    seal: "NAO_CONFIRMADO" as const,
    sharedCount: 1,
    sharedVerdict: "proprio" as const,
  };

  it("keeps Receita when phones have no e164", () => {
    expect(
      overlayGridPhone(
        row,
        enrichment([{ seal: "ATUALIZADO" } as PhoneEvidence]),
      ),
    ).toEqual(row);
  });

  it("keeps Receita when sources is missing", () => {
    expect(
      overlayGridPhone(
        row,
        enrichment([
          { e164: "+5531988887777", seal: "ATUALIZADO" } as PhoneEvidence,
        ]),
      ),
    ).toEqual(row);
  });
});
