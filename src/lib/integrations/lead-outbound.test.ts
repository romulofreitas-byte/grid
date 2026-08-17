import { describe, expect, it } from "vitest";
import type { LeadDossier, LeadEnrichment } from "@/lib/types";
import { toLeadOutbound } from "./lead-outbound";
import { leadOutboundSchema } from "./schema";

const collectedAt = "2026-08-16T12:00:00.000Z";

function enrichment(over: Partial<LeadEnrichment> = {}): LeadEnrichment {
  return {
    cnpj: "12345678000190",
    domain: "clinicaexemplo.com.br",
    domain_status: "confirmado",
    http_status: 200,
    phones: [
      {
        e164: "+553133334444",
        display: "(31) 3333-4444",
        tipo: "fixo",
        sources: ["receita", "site_tel"],
        isWhatsApp: false,
        seal: "CONFIRMADO",
        sharedCount: 1,
        sharedVerdict: "proprio",
      },
      {
        e164: "+5531988877777",
        display: "(31) 98887-7777",
        tipo: "movel",
        sources: ["osm"],
        isWhatsApp: true,
        seal: "NAO_CONFIRMADO",
      },
    ],
    emails: [
      { valor: "contato@clinicaexemplo.com.br", fonte: "site", coletado_em: collectedAt },
    ],
    whatsapp: "+5531999887766",
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
    osm: { matched: true, attribution: "© OpenStreetMap" },
    dor_digital: 12,
    contexto: [],
    fonte: {
      domain: { fonte: "site", coletado_em: collectedAt },
    },
    midiaPaga: { label: "não verificado", verificado_automaticamente: false },
    collected_at: collectedAt,
    expires_at: "2026-09-15T12:00:00.000Z",
    ...over,
  };
}

function dossier(over: Partial<LeadDossier> = {}): LeadDossier {
  return {
    establishment: {
      cnpj: "12345678000190",
      cnpj_basico: "12345678",
      is_matriz: true,
      nome_fantasia: "Clínica Exemplo",
      situacao: "02",
      data_situacao: null,
      data_inicio: "2018-03-01",
      cnae_principal: "8630503",
      cnae_secundarios: [],
      logradouro: "RUA DA BAHIA",
      numero: "100",
      complemento: null,
      bairro: "CENTRO",
      cep: "30130010",
      uf: "MG",
      municipio_id: 3106200,
      ddd1: "31",
      telefone1: "33334444",
      ddd2: null,
      telefone2: null,
      email: "contato@clinicaexemplo.com.br",
    },
    company: {
      cnpj_basico: "12345678",
      razao_social: "CLINICA EXEMPLO LTDA",
      natureza_id: 2062,
      qualificacao_responsavel: 49,
      capital_social: 100000,
      porte: "03",
    },
    cnaeDescricao: "Atividade medica ambulatorial",
    municipioNome: "Belo Horizonte",
    contacts: [
      {
        ddd: "31",
        telefone: "33334444",
        seal: "CONFIRMADO",
        sharedCount: 1,
        sharedVerdict: "proprio",
        label: "Confirmado",
        source: "receita",
      },
    ],
    emailSeal: {
      email: "contato@clinicaexemplo.com.br",
      shared: false,
      free: false,
      accountantHint: false,
    },
    addressSharedCount: 1,
    decisor: {
      nome: "Ana Souza",
      qualificacao: "Sócio-Administrador",
      dataEntrada: "2018-03-01",
      faixaEtaria: 5,
    },
    socios: [],
    gridScore: 88,
    gridPosition: 1,
    status: "novo",
    notas: null,
    savedLeadId: "lead-1",
    enrichment: enrichment(),
    enrichmentJobStatus: "done",
    market: {
      slug: "saude-e-clinicas",
      nome: "clínica",
      dorPrincipal: "em Belo Horizonte, clínica vive de encaminhamento",
      dorChip: "Horário ocioso",
      perguntaConsideracao: "Como está o preenchimento da agenda além do encaminhamento?",
      sazonalidade: null,
      sazonalidadeChip: null,
      sazonalidadeMeses: [],
      sazonalidadeAtiva: false,
      janelaHorario: "melhor no fim da manhã",
      janelaChip: "No fim da manhã",
      cidade: "Belo Horizonte",
    },
    goldenMinute: {
      contexto: "o site de vocês está no ar",
      facts: [{ phrase: "o site de vocês está no ar", fonte: "HTML do site" }],
      insufficient: false,
    },
    ...over,
  };
}

const ctx = {
  searchId: "11111111-1111-4111-8111-111111111111",
  searchName: "Clínicas BH",
  dossierUrl: "https://grid.local/lead/12345678000190",
  nicheSlug: "saude",
  segmentSlugs: ["clinicas"],
  collectedAt,
};

describe("toLeadOutbound", () => {
  it("maps a dossier to the canonical contract", () => {
    const out = toLeadOutbound(dossier(), ctx);
    expect(out.cnpj).toBe("12345678000190");
    expect(out.razao_social).toBe("CLINICA EXEMPLO LTDA");
    expect(out.decisor?.nome).toBe("Ana Souza");
    expect(out.grid_score).toBe(88);
    expect(out.search_id).toBe(ctx.searchId);
    expect(out.osm_matched).toBe(true);
    expect(out.whatsapp).toBe("+5531999887766");
    expect(out.email?.valor).toBe("contato@clinicaexemplo.com.br");
    expect(leadOutboundSchema.parse(out).cnpj).toBe(out.cnpj);
  });

  it("drops OSM-only phones and strips osm from mixed sources", () => {
    const out = toLeadOutbound(dossier(), ctx);
    expect(out.phones.map((p) => p.e164)).toEqual(["+553133334444"]);
    expect(out.phones[0]?.sources).not.toContain("osm");
    expect(JSON.stringify(out)).not.toMatch(/\bosm\b.*\+55/);
  });

  it("never emits a cpf key", () => {
    const out = toLeadOutbound(dossier(), ctx);
    expect(JSON.stringify(out).toLowerCase()).not.toMatch(/cpf/);
    expect(out.decisor).not.toHaveProperty("cpf");
  });

  it("keeps osm_matched as a boolean without exporting the OSM number", () => {
    const out = toLeadOutbound(
      dossier({
        enrichment: enrichment({
          phones: [
            {
              e164: "+5531911122222",
              display: "(31) 91112-2222",
              tipo: "movel",
              sources: ["osm"],
              isWhatsApp: false,
              seal: "NAO_CONFIRMADO",
            },
          ],
          whatsapp: null,
        }),
        contacts: [],
      }),
      ctx,
    );
    expect(out.phones).toEqual([]);
    expect(out.osm_matched).toBe(true);
    expect(out.whatsapp).toBeNull();
  });

  it("omits golden_minute when insufficient", () => {
    const out = toLeadOutbound(
      dossier({
        goldenMinute: { contexto: "", facts: [], insufficient: true },
      }),
      ctx,
    );
    expect(out.golden_minute).toBeNull();
  });
});
