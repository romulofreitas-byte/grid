import { describe, expect, it } from "vitest";
import {
  auditSummary,
  buildAuditSignals,
  defaultAuditSelection,
  emptyAuditSignals,
  isAuditGap,
  isAuditLive,
  isSiteFetchFailed,
  isSiteOffline,
  qualifyChipKind,
  scanningSignalIds,
} from "./signals";
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

function byId(e: LeadEnrichment, id: string) {
  const signal = buildAuditSignals(e).find((s) => s.id === id);
  if (!signal) throw new Error(`missing signal ${id}`);
  return signal;
}

describe("buildAuditSignals", () => {
  it("marks a confirmed site as live and a missing site as a gap", () => {
    const live = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        http_status: 200,
      }),
      "site",
    );
    expect(isAuditLive(live)).toBe(true);
    expect(live.value).toBe("exemplo.com.br");
    expect(live.href).toBe("https://exemplo.com.br");
    expect(live.openLabel).toBe("Abrir site");

    const storefront = byId(
      enrichment({
        domain: "produtosmarina.com.br",
        domain_status: "confirmado",
        http_status: 200,
        homepage_path: "/home",
        fonte: {
          domain: {
            fonte: "human",
            coletado_em: "2026-09-02T12:00:00.000Z",
            path: "/home",
          },
        },
      }),
      "site",
    );
    expect(storefront.value).toBe("produtosmarina.com.br/home");
    expect(storefront.href).toBe("https://produtosmarina.com.br/home");

    const stillLiveOn404 = byId(
      enrichment({
        domain: "mc-bauchemie.com.br",
        domain_status: "confirmado",
        http_status: 404,
      }),
      "site",
    );
    expect(isAuditLive(stillLiveOn404)).toBe(true);
    expect(stillLiveOn404.hint).toMatch(/não abriu agora/i);
    expect(stillLiveOn404.hint).not.toMatch(/confirme/i);
    expect(stillLiveOn404.note).toMatch(/Não abriu agora/);

    const downOn500 = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        http_status: 503,
      }),
      "site",
    );
    expect(downOn500.note).toMatch(/fora do ar/i);

    const gap = byId(enrichment(), "site");
    expect(isAuditGap(gap)).toBe(true);
    expect(gap.value).toBe("NÃO ENCONTRADO");
    expect(gap.hint).toMatch(/Sem site encontrado/i);

    const candidate = byId(
      enrichment({
        domain: "granexpo.com.br",
        domain_status: "nao_confirmado",
        http_status: 403,
      }),
      "site",
    );
    expect(candidate.found).toBe(true);
    expect(candidate.unverified).toBe(true);
    expect(isAuditLive(candidate)).toBe(false);
    expect(candidate.hint).toMatch(/confirme se é o site/i);
    expect(candidate.note).toMatch(/Não abriu agora/);

    const botMissed = byId(
      enrichment({
        domain: "faseimoveis.com.br",
        domain_status: "nao_confirmado",
        http_status: null,
        stage: "complete",
      }),
      "site",
    );
    expect(botMissed.found).toBe(true);
    expect(botMissed.unverified).toBe(true);
    expect(botMissed.note).toMatch(/Não abriu agora/);
    expect(botMissed.note).not.toMatch(/fora do ar/i);
    expect(botMissed.hint).toMatch(/não abriu agora/i);
    expect(botMissed.hint).toMatch(/confirme/i);
    expect(isSiteOffline(enrichment({
      domain: "faseimoveis.com.br",
      domain_status: "nao_confirmado",
      http_status: null,
      stage: "complete",
    }))).toBe(false);
    expect(isSiteFetchFailed(enrichment({
      domain: "faseimoveis.com.br",
      domain_status: "nao_confirmado",
      http_status: null,
      stage: "complete",
    }))).toBe(true);

    const stillScanning = byId(
      enrichment({
        domain: "faseimoveis.com.br",
        domain_status: "nao_confirmado",
        http_status: null,
        stage: "home",
      }),
      "site",
    );
    expect(stillScanning.note ?? "").not.toMatch(/fora do ar/i);
    expect(stillScanning.note ?? "").not.toMatch(/Não abriu agora/);
  });

  it("treats pixel and GTM as unverified until the domain is confirmed", () => {
    const e = enrichment({
      domain: "exemplo.com.br",
      domain_status: "nao_confirmado",
      tech: { ...emptyTech, metaPixel: true, gtm: true },
    });
    const pixel = byId(e, "metaPixel");
    const gtm = byId(e, "gtm");
    const ads = byId(e, "googleAds");
    expect(pixel.unverified).toBe(true);
    expect(pixel.found).toBe(false);
    expect(pixel.value).toBe("NÃO VERIFICADO");
    expect(gtm.unverified).toBe(true);
    expect(ads.unverified).toBe(true);
    expect(isAuditGap(pixel)).toBe(false);
  });

  it("flags missing pixel and GTM as a measurement gap on a confirmed site", () => {
    const e = enrichment({
      domain: "exemplo.com.br",
      domain_status: "confirmado",
      http_status: 200,
      tech: emptyTech,
    });
    const pixel = byId(e, "metaPixel");
    const gtm = byId(e, "gtm");
    expect(isAuditGap(pixel)).toBe(true);
    expect(isAuditGap(gtm)).toBe(true);
    expect(pixel.hint).toMatch(/sem mensuração/i);
  });

  it("does not treat a missing Meta Pixel as a gap when GTM is present", () => {
    const pixel = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        tech: { ...emptyTech, gtm: true },
      }),
      "metaPixel",
    );
    expect(pixel.found).toBe(false);
    expect(pixel.unverified).toBe(true);
    expect(isAuditGap(pixel)).toBe(false);
  });

  it("shows Instagram handle, ads library link, and a gap when the site has no profile", () => {
    const found = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        socials: { instagram: "https://instagram.com/acme.br" },
      }),
      "instagram",
    );
    expect(isAuditLive(found)).toBe(true);
    expect(found.value).toBe("@acme.br");
    expect(found.openLabel).toBe("Abrir Instagram");
    expect(found.links[0]?.label).toBe("Biblioteca de Anúncios");
    expect(found.links[0]?.href).toContain("facebook.com/ads/library");
    expect(found.links[0]?.href).toContain("search_type=keyword_unordered");
    expect(found.links[0]?.href).toContain(encodeURIComponent("@acme.br"));

    const gap = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        socials: {},
      }),
      "instagram",
    );
    expect(isAuditGap(gap)).toBe(true);
    expect(gap.hint).toMatch(/Instagram/i);
  });

  it("marks Serper Instagram without confirmed site as candidate, not live", () => {
    const candidate = byId(
      enrichment({
        domain: null,
        domain_status: "nao_encontrado",
        socials: { instagram: "https://instagram.com/colegiogenesis" },
        fonte: {
          instagram: { fonte: "serper", coletado_em: "2026-08-19T12:00:00.000Z" },
        },
      }),
      "instagram",
    );
    expect(candidate.found).toBe(true);
    expect(candidate.unverified).toBe(true);
    expect(isAuditLive(candidate)).toBe(false);
    expect(candidate.hint).toMatch(/a confirmar/i);
  });

  it("promotes Serper Instagram to live when Maps matches Receita address or phone", () => {
    const live = byId(
      enrichment({
        domain: null,
        domain_status: "nao_encontrado",
        socials: { instagram: "https://instagram.com/distribuidorasilva" },
        gmb: {
          name: "Distribuidora Silva",
          url: "https://maps.google.com/?cid=1",
          matched: true,
          match_by: ["phone"],
        },
        fonte: {
          instagram: { fonte: "serper", coletado_em: "2026-08-19T12:00:00.000Z" },
          gmb: { fonte: "serper", coletado_em: "2026-08-19T12:00:00.000Z" },
        },
      }),
      "instagram",
    );
    expect(isAuditLive(live)).toBe(true);
    expect(live.unverified).toBe(false);
    expect(live.hint).toMatch(/maps/i);

    const gmb = byId(
      enrichment({
        gmb: {
          name: "Distribuidora Silva",
          url: "https://maps.google.com/?cid=1",
          matched: true,
          match_by: ["address", "phone"],
        },
      }),
      "gmb",
    );
    expect(gmb.hint).toMatch(/receita/i);
  });

  it("treats a human-corrected Instagram as found, not a candidate", () => {
    const live = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        socials: { instagram: "https://instagram.com/acme.br" },
        fonte: {
          instagram: { fonte: "human", coletado_em: "2026-09-01T12:00:00.000Z" },
        },
      }),
      "instagram",
    );
    expect(isAuditLive(live)).toBe(true);
    expect(live.unverified).toBe(false);
    expect(live.hint).toMatch(/inserido por você/i);
  });

  it("formats WhatsApp and treats a missing channel as a gap on a confirmed site", () => {
    const found = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        whatsapp: "5511987654321",
      }),
      "whatsapp",
    );
    expect(isAuditLive(found)).toBe(true);
    expect(found.href).toBe("https://wa.me/5511987654321");
    expect(found.value).toBe("(11) 98765-4321");

    const gap = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        whatsapp: null,
      }),
      "whatsapp",
    );
    expect(isAuditGap(gap)).toBe(true);
  });

  it("marks an old copyright year as an update gap", () => {
    const gap = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        freshness: { copyrightYear: 2023 },
      }),
      "atualizacao",
    );
    expect(isAuditGap(gap)).toBe(true);
    expect(gap.value).toBe("rodapé com 2023");
    expect(gap.hint).toMatch(/2023/);
  });

  it("does not treat Facebook as a sales gap when it is missing and was not searched", () => {
    const fb = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        socials: {},
      }),
      "facebook",
    );
    expect(fb.found).toBe(false);
    expect(fb.unverified).toBe(true);
    expect(isAuditGap(fb)).toBe(false);
  });

  it("treats a dedicated Facebook miss as a gap", () => {
    const fb = byId(
      enrichment({
        domain: null,
        domain_status: "nao_encontrado",
        fonte: { facebook: { fonte: "serper_miss", coletado_em: "2026-08-19T12:00:00.000Z" } },
      }),
      "facebook",
    );
    expect(isAuditGap(fb)).toBe(true);
  });

  it("shows Google Meu Negócio when the listing matched", () => {
    const gmb = byId(
      enrichment({
        gmb: {
          name: "Marmoraria Carvalho",
          url: "https://maps.google.com/?cid=1",
          matched: true,
        },
      }),
      "gmb",
    );
    expect(isAuditLive(gmb)).toBe(true);
    expect(gmb.openLabel).toBe("Abrir ficha");
  });

  it("describes Maps card completeness without treating a thin card as missing", () => {
    const thin = byId(
      enrichment({
        gmb: {
          name: "Distribuidora Silva",
          url: "https://maps.google.com/?cid=1",
          matched: true,
          match_by: ["phone"],
          card: {
            filled: ["phone"],
            score: 1,
            rating: null,
            ratingCount: 0,
            category: null,
          },
        },
      }),
      "gmb",
    );
    expect(isAuditLive(thin)).toBe(true);
    expect(thin.sealLabel).toBe("Incompleto");
    expect(thin.note).toMatch(/card 1\/5/i);
    expect(thin.note).toMatch(/falta/i);
    expect(thin.hint).toMatch(/receita/i);

    const full = byId(
      enrichment({
        gmb: {
          name: "Marmoraria Carvalho",
          url: "https://maps.google.com/?cid=1",
          matched: true,
          match_by: ["title", "address"],
          card: {
            filled: ["phone", "website", "hours", "photo", "reviews"],
            score: 5,
            rating: 4.8,
            ratingCount: 210,
            category: "Marble contractor",
          },
        },
      }),
      "gmb",
    );
    expect(full.sealLabel).toBe("Completo");
    expect(full.note).toMatch(/card completo/i);
    expect(full.note).toMatch(/4,8/);
    expect(full.note).toMatch(/210/);
  });

  it("attaches the OSM mismatch note to the site signal", () => {
    const site = byId(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        osm: { matched: false, attribution: "© OpenStreetMap" },
      }),
      "site",
    );
    expect(site.note).toMatch(/OpenStreetMap tem outro número/);
    expect(site.note).toMatch(/OpenStreetMap/);
  });

  it("selects the first gap by default and summarizes live vs gaps", () => {
    const signals = buildAuditSignals(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        http_status: 200,
        socials: {},
        whatsapp: "5511999999999",
        tech: { ...emptyTech, metaPixel: true, gtm: true },
      }),
    );
    expect(defaultAuditSelection(signals)).toBe("instagram");
    expect(isAuditGap(signals.find((s) => s.id === defaultAuditSelection(signals))!)).toBe(
      true,
    );

    const missingSite = buildAuditSignals(enrichment());
    expect(defaultAuditSelection(missingSite)).toBe("site");

    const summary = auditSummary(missingSite);
    expect(summary.gaps).toBeGreaterThan(0);
    expect(summary.live).toBe(0);
  });

  it("builds a pending logo board and maps stages to scanning tiles", () => {
    const pending = emptyAuditSignals();
    expect(pending).toHaveLength(18);
    expect(pending.every((s) => s.unverified && !s.found)).toBe(true);
    expect(scanningSignalIds(null, true)).toEqual(["site"]);
    expect(scanningSignalIds("home", true)).toEqual(["site"]);
    expect(scanningSignalIds("presence", true, enrichment({
      fonte: { presence_scan: { fonte: "instagram", coletado_em: "2026-08-19T12:00:00.000Z" } },
    }))).toEqual(["instagram"]);
    expect(scanningSignalIds("site", true)).toContain("atualizacao");
    expect(scanningSignalIds("site", true)).toContain("gtm");
    expect(scanningSignalIds("complete", true)).toEqual([]);
    expect(scanningSignalIds("home", false)).toEqual([]);
  });
});

describe("qualifyChipKind", () => {
  it("is Qualificada when site, Instagram and Google are live", () => {
    const signals = buildAuditSignals(
      enrichment({
        domain: "exemplo.com.br",
        domain_status: "confirmado",
        http_status: 200,
        socials: { instagram: "https://instagram.com/exemplo" },
        gmb: {
          name: "Exemplo",
          url: "https://maps.google.com/?cid=1",
          matched: true,
          match_by: ["phone"],
        },
      }),
    );
    expect(qualifyChipKind(signals, { scanning: false, complete: true })).toBe(
      "qualificada",
    );
  });

  it("is Oportunidade when site or Instagram is missing", () => {
    const signals = buildAuditSignals(
      enrichment({
        domain: null,
        domain_status: "nao_encontrado",
        gmb: {
          name: "Exemplo",
          url: "https://maps.google.com/?cid=1",
          matched: true,
          match_by: ["phone"],
        },
      }),
    );
    expect(qualifyChipKind(signals, { scanning: false, complete: true })).toBe(
      "oportunidade",
    );
  });

  it("is Qualificando while the first read is in progress", () => {
    expect(
      qualifyChipKind(emptyAuditSignals(), {
        scanning: true,
        complete: false,
      }),
    ).toBe("qualificando");
  });

  it("hides the chip before a completed read", () => {
    expect(
      qualifyChipKind(emptyAuditSignals(), {
        scanning: false,
        complete: false,
      }),
    ).toBeNull();
  });
});
