import { describe, expect, it, vi } from "vitest";
import {
  buildCrmBriefing,
  loadCrmBriefing,
  shouldFetchDossier,
} from "./briefing";
import type { CrmDeal } from "./types";
import type { LeadDossier, LeadEnrichment, TechSignals } from "@/lib/types";

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

function deal(patch: Partial<CrmDeal> = {}): CrmDeal {
  return {
    id: "deal-1",
    pipeline_id: "p",
    stage_id: "s",
    company_name: "Padaria Central",
    contact_name: "Ana",
    secretaries: ["Bia"],
    people: [{ name: "Ana", phone: "(34) 99999-0000", email: "ana@x.com" }],
    phones: ["(34) 3333-1010"],
    notes: "",
    cnpj: null,
    meta: {},
    outcome: "open",
    position: 0,
    created_at: "2026-09-01T12:00:00.000Z",
    updated_at: "2026-09-01T12:00:00.000Z",
    ...patch,
  };
}

function enrichment(partial: Partial<LeadEnrichment> = {}): LeadEnrichment {
  return {
    cnpj: "12345678000190",
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

function dossier(partial: Partial<LeadDossier> = {}): LeadDossier {
  return {
    establishment: {
      cnpj: "12345678000190",
      cnpj_basico: "12345678",
      is_matriz: true,
      nome_fantasia: "Padaria Central",
      situacao: "ATIVA",
      data_situacao: null,
      data_inicio: null,
      cnae_principal: "5611203",
      cnae_secundarios: [],
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cep: null,
      uf: "MG",
      municipio_id: 3106200,
      ddd1: "31",
      telefone1: "33334444",
      ddd2: null,
      telefone2: null,
      email: null,
    },
    municipioNome: "Uberlândia",
    decisor: {
      nome: "Carlos",
      qualificacao: "Sócio",
      dataEntrada: null,
      faixaEtaria: null,
    },
    enrichment: null,
    ...partial,
  } as LeadDossier;
}

describe("crm briefing", () => {
  it("marks presence badges from enrichment found flags", () => {
    const row = buildCrmBriefing(
      deal({ cnpj: "12345678000190" }),
      dossier({
        enrichment: enrichment({
          domain: "padaria.com.br",
          domain_status: "confirmado",
          http_status: 200,
          socials: { instagram: "https://instagram.com/padaria" },
          whatsapp: null,
        }),
      }),
    );
    expect(row.badges.find((badge) => badge.id === "site")?.found).toBe(true);
    expect(row.badges.find((badge) => badge.id === "instagram")?.found).toBe(
      true,
    );
    expect(row.badges.find((badge) => badge.id === "whatsapp")?.found).toBe(
      false,
    );
    expect(row.badges.find((badge) => badge.id === "gmb")?.found).toBe(false);
    expect(row.municipio).toBe("Uberlândia");
  });

  it("skips the lookup when the deal has no CNPJ", async () => {
    expect(shouldFetchDossier(null)).toBe(false);
    const getLookup = vi.fn();
    const row = await loadCrmBriefing(deal({ cnpj: null }), getLookup);
    expect(getLookup).not.toHaveBeenCalled();
    expect(row.company).toBe("Padaria Central");
    expect(row.phone).toBe("(34) 3333-1010");
    expect(row.phones).toEqual(["(34) 3333-1010", "(34) 99999-0000"]);
    expect(row.contact).toBe("Ana");
    expect(row.badges.every((badge) => !badge.found)).toBe(true);
  });

  it("applies a slim lookup without a full dossier", async () => {
    const getLookup = vi.fn().mockResolvedValue({
      municipioNome: "Uberlândia",
      extraPhones: ["(31) 3333-5555"],
      presence: {
        site: true,
        instagram: false,
        whatsapp: true,
        gmb: false,
      },
    });
    const row = await loadCrmBriefing(deal({ cnpj: "12345678000190" }), getLookup);
    expect(getLookup).toHaveBeenCalledWith("12345678000190");
    expect(row.municipio).toBe("Uberlândia");
    expect(row.phones).toEqual([
      "(34) 3333-1010",
      "(34) 99999-0000",
      "(31) 3333-5555",
    ]);
    expect(row.badges.find((badge) => badge.id === "site")?.found).toBe(true);
    expect(row.badges.find((badge) => badge.id === "whatsapp")?.found).toBe(
      true,
    );
  });

  it("lists extra receita and contact phones without duplicates", () => {
    const row = buildCrmBriefing(
      deal({
        phones: ["(31) 3333-4444"],
        people: [{ name: "Ana", phone: "", email: "" }],
        secretaries: [],
      }),
      dossier({
        establishment: {
          ...dossier().establishment,
          ddd1: "31",
          telefone1: "33334444",
          ddd2: "31",
          telefone2: "33335555",
        },
        contacts: [
          {
            ddd: "31",
            telefone: "33335555",
            seal: "CONFIRMADO",
            sharedCount: 1,
            label: "Receita",
            source: "receita",
          },
          {
            ddd: "34",
            telefone: "33331010",
            seal: "CONFIRMADO",
            sharedCount: 1,
            label: "Site",
            source: "site",
          },
        ],
      }),
    );
    expect(row.phones).toEqual([
      "(31) 3333-4444",
      "(31) 3333-5555",
      "(34) 3333-1010",
    ]);
  });
});
