import { describe, expect, it } from "vitest";
import {
  dealFieldsFromCompanyHit,
  dealFieldsFromDossier,
  findDealByCnpj,
  mergeDealPhones,
  sociosFromPartners,
} from "./add-deal";
import { dealCreateSchema } from "./schema";
import type { CompanySearchHit, LeadDossier, PartnerCard } from "@/lib/types";

const hit: CompanySearchHit = {
  cnpj: "12.345.678/0001-90",
  razaoSocial: "MARMORARIA CARVALHO LTDA",
  nomeFantasia: "Carvalho Pedras",
  municipio: "Uberlândia",
  uf: "MG",
  cnaeCodigo: "2391501",
  cnaeDescricao: "Marmoraria",
  telefone: "34999990000",
  decisorNome: "Ana Carvalho",
};

function partner(nome: string, qualificacao = "Sócio"): PartnerCard {
  return {
    nome,
    qualificacao,
    dataEntrada: null,
    faixaEtaria: null,
    kind: "pessoa",
    kindLabel: null,
  };
}

describe("dealFieldsFromCompanyHit", () => {
  it("maps fantasia, decisor, phone and digits CNPJ", () => {
    expect(dealFieldsFromCompanyHit(hit)).toEqual({
      company_name: "Carvalho Pedras",
      contact_name: "Ana Carvalho",
      phones: ["(34) 99999-0000"],
      cnpj: "12345678000190",
      municipio: "Uberlândia",
      uf: "MG",
    });
  });

  it("falls back to razão when there is no fantasia", () => {
    expect(
      dealFieldsFromCompanyHit({ ...hit, nomeFantasia: null, decisorNome: null, telefone: null })
        .company_name,
    ).toBe("MARMORARIA CARVALHO LTDA");
  });
});

describe("dealFieldsFromDossier", () => {
  it("collects sócios and extra phones without duplicating", () => {
    const dossier = {
      contacts: [
        {
          ddd: "34",
          telefone: "999990000",
          seal: "CONFIRMADO" as const,
          sharedCount: 1,
          label: "Receita",
          source: "receita" as const,
        },
        {
          ddd: "34",
          telefone: "32323232",
          seal: "NAO_CONFIRMADO" as const,
          sharedCount: 1,
          label: "Receita",
          source: "receita" as const,
        },
      ],
      socios: [partner("Ana Carvalho"), partner("Bia Souza", "Administrador")],
      decisor: {
        nome: "Ana Carvalho",
        qualificacao: "Sócio",
        dataEntrada: null,
        faixaEtaria: null,
      },
    } satisfies Pick<LeadDossier, "contacts" | "socios" | "decisor">;

    const extras = dealFieldsFromDossier(dossier);
    expect(extras.contact_name).toBe("Ana Carvalho");
    expect(extras.socios.map((s) => s.nome)).toEqual(["Ana Carvalho", "Bia Souza"]);
    expect(extras.phones).toEqual(["(34) 99999-0000", "(34) 3232-3232"]);
  });
});

describe("sociosFromPartners", () => {
  it("drops blanks and duplicate names", () => {
    expect(
      sociosFromPartners([
        partner(" Ana "),
        partner(""),
        partner("ana"),
        partner("Bia"),
      ]).map((s) => s.nome),
    ).toEqual(["Ana", "Bia"]);
  });
});

describe("mergeDealPhones", () => {
  it("caps at 8 and skips the same number in another format", () => {
    const extra = Array.from({ length: 10 }, (_, i) => `3490000000${i}`.slice(0, 11));
    expect(mergeDealPhones(["(34) 99999-0000"], ["34999990000", ...extra]).length).toBeLessThanOrEqual(
      8,
    );
    expect(mergeDealPhones(["(34) 99999-0000"], ["34999990000"])).toEqual(["(34) 99999-0000"]);
  });
});

describe("findDealByCnpj", () => {
  it("matches formatted and digits CNPJ on the same pipeline", () => {
    const deals = [
      { id: "a", cnpj: null },
      { id: "b", cnpj: "12345678000190" },
    ];
    expect(findDealByCnpj(deals, "12.345.678/0001-90")?.id).toBe("b");
    expect(findDealByCnpj(deals, "00000000000191")).toBeNull();
  });
});

describe("dealCreateSchema", () => {
  it("accepts a manual create without CNPJ", () => {
    const parsed = dealCreateSchema.parse({
      company_name: "Padaria do Zé",
      contact_name: "Zé",
      secretaries: ["Maria"],
    });
    expect(parsed.cnpj).toBeUndefined();
    expect(parsed.company_name).toBe("Padaria do Zé");
  });

  it("normalizes CNPJ and keeps phones and crm_add source", () => {
    const parsed = dealCreateSchema.parse({
      company_name: "Carvalho Pedras",
      contact_name: "Ana",
      phones: ["(34) 99999-0000"],
      cnpj: "12.345.678/0001-90",
      meta: { source: "crm_add" },
    });
    expect(parsed.cnpj).toBe("12345678000190");
    expect(parsed.phones).toEqual(["(34) 99999-0000"]);
    expect(parsed.meta).toEqual({ source: "crm_add" });
  });

  it("treats empty CNPJ as missing", () => {
    expect(dealCreateSchema.parse({ company_name: "X", cnpj: "" }).cnpj).toBeUndefined();
    expect(dealCreateSchema.parse({ company_name: "X", cnpj: null }).cnpj).toBeUndefined();
  });
});
