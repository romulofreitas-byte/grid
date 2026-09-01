import { describe, expect, it } from "vitest";
import {
  applyPresenceCorrection,
  PresenceCorrectionError,
} from "./correct-presence";
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
    stage: "complete",
    collected_at: "2026-08-13T12:00:00.000Z",
    expires_at: "2026-09-12T12:00:00.000Z",
    ...partial,
  };
}

describe("applyPresenceCorrection", () => {
  it("turns an Instagram @handle into a canonical URL", () => {
    const result = applyPresenceCorrection(enrichment(), {
      instagram: "@acme.br",
    });
    expect(result.kind).toBe("patch");
    if (result.kind !== "patch") return;
    expect(result.row.socials.instagram).toBe("https://instagram.com/acme.br");
    expect(result.row.fonte.instagram?.fonte).toBe("human");
  });

  it("rejects an invalid social URL", () => {
    expect(() =>
      applyPresenceCorrection(enrichment(), { facebook: "not a url" }),
    ).toThrow(PresenceCorrectionError);
  });

  it("clears Instagram when the value is null", () => {
    const result = applyPresenceCorrection(
      enrichment({
        socials: { instagram: "https://instagram.com/errado" },
      }),
      { instagram: null },
    );
    expect(result.kind).toBe("patch");
    if (result.kind !== "patch") return;
    expect(result.row.socials.instagram).toBeUndefined();
    expect(result.row.fonte.instagram?.fonte).toBe("human");
  });

  it("returns recrawl for a new site instead of patching", () => {
    const result = applyPresenceCorrection(enrichment(), {
      domain: "https://www.novo-site.com.br/contato",
    });
    expect(result).toEqual({ kind: "recrawl", domain: "novo-site.com.br" });
  });

  it("clears the site without recrawling", () => {
    const result = applyPresenceCorrection(
      enrichment({ domain: "errado.com.br" }),
      { domain: null },
    );
    expect(result.kind).toBe("patch");
    if (result.kind !== "patch") return;
    expect(result.row.domain).toBeNull();
    expect(result.row.domain_status).toBe("nao_encontrado");
    expect(result.row.http_status).toBeNull();
    expect(result.row.discarded_domains).toContain("errado.com.br");
    expect(result.row.fonte.domain?.fonte).toBe("human");
  });

  it("stores a WhatsApp number from wa.me", () => {
    const result = applyPresenceCorrection(enrichment(), {
      whatsapp: "https://wa.me/5531999887766",
    });
    expect(result.kind).toBe("patch");
    if (result.kind !== "patch") return;
    expect(result.row.whatsapp).toBe("5531999887766");
  });

  it("drops Instagram pain after a human correction", () => {
    const withIg = applyPresenceCorrection(
      enrichment({ domain_status: "confirmado", socials: {} }),
      { instagram: "https://instagram.com/acme" },
    );
    const cleared = applyPresenceCorrection(
      enrichment({
        domain_status: "confirmado",
        socials: { instagram: "https://instagram.com/acme" },
      }),
      { instagram: null },
    );
    expect(withIg.kind).toBe("patch");
    expect(cleared.kind).toBe("patch");
    if (withIg.kind !== "patch" || cleared.kind !== "patch") return;
    expect(cleared.row.dor_digital - withIg.row.dor_digital).toBe(8);
  });
});
