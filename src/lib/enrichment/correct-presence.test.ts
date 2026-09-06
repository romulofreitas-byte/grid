import { describe, expect, it } from "vitest";
import {
  applyMapsConfirm,
  applyPresenceCorrection,
  applySiteConfirm,
  applySiteReject,
  hasPresenceFields,
  mapsPinConfirmable,
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

  it("returns recrawl for a new site and patches the host immediately", () => {
    const result = applyPresenceCorrection(enrichment(), {
      domain: "https://www.novo-site.com.br/contato",
    });
    expect(result.kind).toBe("recrawl");
    if (result.kind !== "recrawl") return;
    expect(result.domain).toBe("novo-site.com.br");
    expect(result.homepagePath).toBeNull();
    expect(result.row.domain).toBe("novo-site.com.br");
    expect(result.row.domain_status).toBe("confirmado");
  });

  it("keeps /home on a human site correction", () => {
    const result = applyPresenceCorrection(enrichment(), {
      domain: "https://www.produtosmarina.com.br/home/",
    });
    expect(result.kind).toBe("recrawl");
    if (result.kind !== "recrawl") return;
    expect(result.domain).toBe("produtosmarina.com.br");
    expect(result.homepagePath).toBe("/home");
    expect(result.row.homepage_path).toBe("/home");
    expect(result.row.fonte.domain?.path).toBe("/home");
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

  it("confirms a candidate host without waiting for a recrawl", () => {
    const result = applySiteConfirm(
      enrichment({
        domain: "granexpo.com.br",
        domain_status: "nao_confirmado",
        http_status: 403,
      }),
      "https://www.granexpo.com.br",
    );
    expect(result.domain).toBe("granexpo.com.br");
    expect(result.domain_status).toBe("confirmado");
    expect(result.http_status).toBe(403);
    expect(result.fonte.domain?.fonte).toBe("human");
    expect(result.homepage_path ?? null).toBeNull();
  });

  it("rejects a candidate host and keeps it discarded", () => {
    const result = applySiteReject(
      enrichment({
        domain: "errado.com.br",
        domain_status: "nao_confirmado",
        http_status: 403,
      }),
      "errado.com.br",
    );
    expect(result.domain).toBeNull();
    expect(result.domain_status).toBe("nao_encontrado");
    expect(result.discarded_domains).toContain("errado.com.br");
    expect(result.fonte.domain?.fonte).toBe("human");
  });

  it("stores a WhatsApp number from wa.me", () => {
    const result = applyPresenceCorrection(enrichment(), {
      whatsapp: "https://wa.me/5531999887766",
    });
    expect(result.kind).toBe("patch");
    if (result.kind !== "patch") return;
    expect(result.row.whatsapp).toBe("5531999887766");
  });

  it("stores a Maps cid from a Google listing URL", () => {
    const result = applyPresenceCorrection(enrichment(), {
      gmb: "https://www.google.com/maps?cid=918273",
    });
    expect(result.kind).toBe("patch");
    if (result.kind !== "patch") return;
    expect(result.row.gmb?.matched).toBe(true);
    expect(result.row.gmb?.status).toBe("matched");
    expect(result.row.gmb?.cid).toBe("918273");
    expect(result.row.gmb?.url).toBe("https://www.google.com/maps?cid=918273");
    expect(result.row.fonte.gmb?.fonte).toBe("human");
  });

  it("accepts maps as an alias for the listing URL", () => {
    const result = applyPresenceCorrection(enrichment(), {
      maps: "https://www.google.com/maps?cid=918273",
    });
    expect(result.kind).toBe("patch");
    if (result.kind !== "patch") return;
    expect(result.row.gmb?.cid).toBe("918273");
    expect(result.row.fonte.maps?.fonte).toBe("human");
  });

  it("crava a ficha from a /place/ URL the operator copied from Maps", () => {
    const href =
      "https://www.google.com/maps/place/Drimafer+M%C3%A1quinas+e+Equipamentos/@-23.6940753,-46.6088771,17z/data=!3m1!4b1!4m6!3m5!1s0x94ce455536cfb6c9:0xce7f0a7f9addee96!8m2!3d-23.6940753!4d-46.6088771";
    const result = applyPresenceCorrection(enrichment(), { maps: href });
    expect(result.kind).toBe("patch");
    if (result.kind !== "patch") return;
    const cid = BigInt("0xce7f0a7f9addee96").toString(10);
    expect(result.row.gmb?.matched).toBe(true);
    expect(result.row.gmb?.cid).toBe(cid);
    expect(result.row.gmb?.url).toBe(`https://www.google.com/maps?cid=${cid}`);
    expect(result.row.gmb?.name).toBe("Drimafer Máquinas e Equipamentos");
  });

  it("crava a stored Maps candidate without a pasted URL", () => {
    const row = enrichment({
      gmb: {
        name: "Pizza Hut",
        url: "https://www.google.com/maps?cid=222",
        matched: false,
        status: "candidate",
        cid: "222",
        card: {
          filled: ["reviews"],
          score: 1,
          rating: 4.2,
          ratingCount: 80,
          category: null,
        },
      },
    });
    expect(mapsPinConfirmable(row)).toBe(true);
    expect(hasPresenceFields({ confirmMaps: true })).toBe(true);
    const result = applyPresenceCorrection(row, { confirmMaps: true });
    expect(result.kind).toBe("patch");
    if (result.kind !== "patch") return;
    expect(result.row.gmb?.matched).toBe(true);
    expect(result.row.gmb?.status).toBe("matched");
    expect(result.row.gmb?.cid).toBe("222");
    expect(result.row.gmb?.name).toBe("Pizza Hut");
    expect(result.row.gmb?.card?.ratingCount).toBe(80);
    expect(result.row.fonte.gmb?.fonte).toBe("human");
    expect(result.row.fonte.maps?.fonte).toBe("human");
  });

  it("does not confirm a Maps miss that is only a search URL", () => {
    const miss = enrichment({
      gmb: {
        name: "",
        url: "https://www.google.com/maps/search/?api=1&query=Mexicar",
        matched: false,
        status: "none",
      },
    });
    expect(mapsPinConfirmable(miss)).toBe(false);
    expect(() => applyMapsConfirm(miss)).toThrow(PresenceCorrectionError);
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
