import { describe, expect, it } from "vitest";
import { buildPdf } from "./pdf";
import { DEFAULT_FILTERS, type LeadDossier } from "@/lib/types";

const lead = {
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
    email: null,
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
    email: null,
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
  socios: [],
  gridScore: 72,
  gridPosition: 1,
  status: "novo" as const,
  notas: null,
  savedLeadId: null,
  enrichment: null,
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

describe("buildPdf", () => {
  it("returns a real PDF buffer", async () => {
    const buf = await buildPdf([lead], {
      nome: "Lista teste",
      total: 1,
      created_at: "2026-08-21T00:00:00.000Z",
    });
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buf.includes(Buffer.from("GRID-MOCK"))).toBe(false);
  });

  it("accepts list filters for header badges without failing", async () => {
    const buf = await buildPdf([lead], {
      nome: "Lista teste",
      total: 1,
      created_at: "2026-08-21T00:00:00.000Z",
      filters: {
        ...DEFAULT_FILTERS,
        intentQuery: "pet shop",
        ufs: ["MG"],
        soMatriz: true,
        ocultarTelefonesCompartilhados: true,
      },
      segmentNames: {},
    });
    expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(100);
  });
});
