import { describe, expect, it } from "vitest";
import { redactGridRow, redactCompanySearchHit, redactDossier } from "./redact";
import type { GridRow, LeadDossier } from "@/lib/types";

const gridRow: GridRow = {
  cnpj: "12345678000190",
  razaoSocial: "ACME LTDA",
  nomeFantasia: "Acme",
  municipio: "Belo Horizonte",
  uf: "MG",
  cnaeCodigo: "5611201",
  cnaeDescricao: "Restaurante",
  telefone: "31999998888",
  seal: "NAO_CONFIRMADO",
  sharedCount: 1,
  decisorNome: "JOSE SILVA",
  porte: "01",
  email: "contato@acme.com.br",
  gridScore: 80,
  gridPosition: 1,
  enrichmentStatus: null,
  hasAudit: false,
};

describe("redactGridRow", () => {
  it("masks phone, email and decisor on free plan", () => {
    const out = redactGridRow(gridRow, false);
    expect(out.telefone).toBe("••••-••••");
    expect(out.email).toBe("••••@••••");
    expect(out.decisorNome).toBeNull();
    expect(out.razaoSocial).toBe("ACME LTDA");
  });

  it("leaves paid plan rows intact", () => {
    expect(redactGridRow(gridRow, true)).toEqual(gridRow);
  });

  it("reveals a Treino livre row after that CNPJ was qualified", () => {
    const revealed = new Set(["12345678000190"]);
    expect(redactGridRow(gridRow, false, revealed)).toEqual(gridRow);
    const other = redactGridRow(
      { ...gridRow, cnpj: "98765432000100" },
      false,
      revealed,
    );
    expect(other.telefone).toBe("••••-••••");
    expect(other.decisorNome).toBeNull();
  });
});

describe("redactCompanySearchHit", () => {
  const hit = {
    cnpj: "12345678000190",
    razaoSocial: "ACME LTDA",
    nomeFantasia: "Acme",
    municipio: "Belo Horizonte",
    uf: "MG",
    cnaeCodigo: "5611201",
    cnaeDescricao: "Restaurante",
    telefone: "31999998888",
    decisorNome: "JOSE SILVA",
  };

  it("masks phone and decisor on free plan", () => {
    const out = redactCompanySearchHit(hit, false);
    expect(out.telefone).toBe("••••-••••");
    expect(out.decisorNome).toBeNull();
  });

  it("leaves paid plan hits intact", () => {
    expect(redactCompanySearchHit(hit, true)).toEqual(hit);
  });

  it("reveals a Treino livre hit after that CNPJ was qualified", () => {
    expect(
      redactCompanySearchHit(hit, false, new Set(["12345678000190"])),
    ).toEqual(hit);
  });
});

describe("redactDossier", () => {
  const dossier = {
    establishment: {
      cnpj: "12345678000190",
      cnpj_basico: "12345678",
      is_matriz: true,
      nome_fantasia: "Acme",
      situacao: "02",
      data_situacao: null,
      data_inicio: null,
      cnae_principal: "5611201",
      cnae_secundarios: [],
      logradouro: "Rua A",
      numero: "1",
      complemento: null,
      bairro: "Centro",
      cep: "30130000",
      uf: "MG",
      municipio_id: 1,
      ddd1: "31",
      telefone1: "999998888",
      ddd2: null,
      telefone2: null,
      email: "contato@acme.com",
    },
    company: {
      cnpj_basico: "12345678",
      razao_social: "ACME LTDA",
      natureza_id: 1,
      qualificacao_responsavel: 1,
      capital_social: 10000,
      porte: "01",
    },
    cnaeDescricao: "Restaurante",
    municipioNome: "Belo Horizonte",
    contacts: [
      {
        ddd: "31",
        telefone: "999998888",
        seal: "NAO_CONFIRMADO" as const,
        sharedCount: 1,
        label: "Receita",
        source: "receita" as const,
      },
    ],
    emailSeal: {
      email: "contato@acme.com",
      shared: false,
      free: false,
      accountantHint: false,
    },
    addressSharedCount: 1,
    decisor: {
      nome: "JOSE SILVA",
      qualificacao: "Sócio",
      dataEntrada: null,
      faixaEtaria: null,
    },
    socios: [
      {
        nome: "JOSE SILVA",
        qualificacao: "Sócio",
        dataEntrada: null,
        faixaEtaria: null,
        kind: "pessoa" as const,
        kindLabel: "Pessoa",
      },
    ],
    gridScore: 80,
    gridPosition: 1,
    status: "novo" as const,
    notas: null,
    savedLeadId: null,
    enrichment: {
      cnpj: "12345678000190",
      domain: "acme.com",
      domain_status: "confirmado" as const,
      http_status: 200,
      phones: [],
      emails: [],
      whatsapp: null,
      socials: {},
      tech: {
        metaPixel: true,
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
      dor_digital: 3,
      contexto: ["site"],
      fonte: {},
      midiaPaga: {
        label: "sinais de mídia paga detectados",
        verificado_automaticamente: true,
      },
      stage: "complete" as const,
      collected_at: "2026-01-01T00:00:00.000Z",
      expires_at: "2026-12-01T00:00:00.000Z",
    },
    enrichmentJobStatus: null,
    market: {
      slug: "generico",
      nome: "este ramo",
      dorPrincipal: "dor",
      dorChip: "Indicação",
      perguntaConsideracao: "pergunta",
      sazonalidade: null,
      sazonalidadeChip: null,
      sazonalidadeMeses: [],
      sazonalidadeAtiva: false,
      janelaHorario: "De manhã",
      janelaChip: "De manhã",
      cidade: "Belo Horizonte",
    },
    goldenMinute: { contexto: "", facts: [], insufficient: true },
  } satisfies LeadDossier;

  it("strips enrichment when user did not pay for qualify", () => {
    const out = redactDossier(dossier, {
      showEnrichment: false,
      showContacts: true,
    });
    expect(out.enrichment?.domain).toBeNull();
    expect(out.contacts[0]?.telefone).toBe("999998888");
  });

  it("masks contacts on free plan", () => {
    const out = redactDossier(dossier, {
      showEnrichment: false,
      showContacts: false,
    });
    expect(out.establishment.telefone1).toBeNull();
    expect(out.emailSeal.email).toBeNull();
    expect(out.socios[0]?.nome).toContain("Assine");
  });
});
