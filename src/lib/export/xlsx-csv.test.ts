import { describe, expect, it } from "vitest";
import { exportPhoneColumns } from "./xlsx-csv";
import { GOLDEN_MINUTE_PLACEHOLDER } from "@/lib/golden-minute";
import type { LeadDossier, LeadEnrichment, PhoneEvidence } from "@/lib/types";

const emptyTech = {
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

function evidence(
  partial: Pick<PhoneEvidence, "e164" | "display" | "sources" | "seal"> &
    Partial<PhoneEvidence>,
): PhoneEvidence {
  return {
    tipo: "fixo",
    isWhatsApp: false,
    sharedCount: 1,
    sharedVerdict: "proprio",
    ...partial,
  };
}

function dossier(enrichment: LeadEnrichment | null): LeadDossier {
  return {
    establishment: {
      cnpj: "12345678000190",
      cnpj_basico: "12345678",
      is_matriz: true,
      nome_fantasia: "Clinica Sol",
      situacao: "02",
      data_situacao: null,
      data_inicio: null,
      cnae_principal: "8630503",
      cnae_secundarios: [],
      logradouro: "Rua A",
      numero: "1",
      complemento: null,
      bairro: "Centro",
      cep: "30120000",
      uf: "MG",
      municipio_id: 3106200,
      ddd1: "31",
      telefone1: "33331111",
      ddd2: null,
      telefone2: null,
      email: "contato@clinica.com.br",
    },
    company: {
      cnpj_basico: "12345678",
      razao_social: "Clinica Sol Ltda",
      natureza_id: null,
      qualificacao_responsavel: null,
      capital_social: 10000,
      porte: "03",
    },
    cnaeDescricao: "Atividade medica",
    municipioNome: "Belo Horizonte",
    contacts: [
      {
        ddd: "31",
        telefone: "33331111",
        seal: "CONFIRMADO",
        sharedCount: 1,
        label: "Confirmado",
        source: "site",
      },
    ],
    emailSeal: {
      email: "contato@clinica.com.br",
      shared: false,
      free: false,
      accountantHint: false,
    },
    addressSharedCount: 1,
    decisor: null,
    socios: [],
    gridScore: 80,
    gridPosition: 1,
    status: "novo",
    notas: null,
    savedLeadId: null,
    enrichment,
    enrichmentJobStatus: null,
    market: {
      slug: "saude-e-clinicas",
      nome: "clínica",
      dorPrincipal: "em Belo Horizonte, clínica vive de encaminhamento",
      dorChip: "Horário ocioso",
      perguntaConsideracao: "Como está o preenchimento da agenda?",
      sazonalidade: null,
      sazonalidadeChip: null,
      sazonalidadeMeses: [],
      sazonalidadeAtiva: false,
      janelaHorario: "melhor no fim da manhã",
      janelaChip: "No fim da manhã",
      cidade: "Belo Horizonte",
    },
    goldenMinute: {
      contexto: GOLDEN_MINUTE_PLACEHOLDER,
      facts: [],
      insufficient: true,
    },
  };
}

function enrichment(phones: PhoneEvidence[]): LeadEnrichment {
  return {
    cnpj: "12345678000190",
    domain: "clinica.com.br",
    domain_status: "confirmado",
    http_status: 200,
    phones,
    emails: [],
    whatsapp: null,
    socials: {},
    tech: emptyTech,
    freshness: {},
    osm: { matched: true, attribution: "© OpenStreetMap contributors" },
    dor_digital: 0,
    contexto: [],
    fonte: {},
    midiaPaga: { label: "NÃO VERIFICADO", verificado_automaticamente: false },
    collected_at: "2026-08-16T12:00:00.000Z",
    expires_at: "2026-09-15T12:00:00.000Z",
  };
}

describe("exportPhoneColumns", () => {
  it("fills Receita and Site from the same CONFIRMADO evidence", () => {
    const cols = exportPhoneColumns(
      dossier(
        enrichment([
          evidence({
            e164: "+553133331111",
            display: "(31) 3333-1111",
            sources: ["receita", "site_tel"],
            seal: "CONFIRMADO",
          }),
        ]),
      ),
    );
    expect(cols.principal).toBe("(31) 3333-1111");
    expect(cols.receita).toBe("(31) 3333-1111");
    expect(cols.site).toBe("(31) 3333-1111");
  });

  it("keeps Receita and Site distinct on ATUALIZADO", () => {
    const cols = exportPhoneColumns(
      dossier(
        enrichment([
          evidence({
            e164: "+553198887777",
            display: "(31) 98887-7777",
            sources: ["site_tel"],
            seal: "ATUALIZADO",
          }),
          evidence({
            e164: "+553133331111",
            display: "(31) 3333-1111",
            sources: ["receita"],
            seal: "NAO_CONFIRMADO",
          }),
        ]),
      ),
    );
    expect(cols.site).toBe("(31) 98887-7777");
    expect(cols.receita).toBe("(31) 3333-1111");
  });

  it("never exports an OSM-only number", () => {
    const cols = exportPhoneColumns(
      dossier(
        enrichment([
          evidence({
            e164: "+553133331111",
            display: "(31) 3333-1111",
            sources: ["receita"],
            seal: "NAO_CONFIRMADO",
          }),
          evidence({
            e164: "+5531999990000",
            display: "(31) 99999-0000",
            sources: ["osm"],
            seal: "NAO_CONFIRMADO",
          }),
        ]),
      ),
    );
    expect(cols.site).toBe("");
    expect(cols.receita).toBe("(31) 3333-1111");
    expect(JSON.stringify(cols)).not.toContain("99999-0000");
  });
});
