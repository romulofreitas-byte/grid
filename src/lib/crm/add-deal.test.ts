import { describe, expect, it } from "vitest";
import {
  attachCompanyHitToDeal,
  dealFieldsFromCompanyHit,
  dealFieldsFromDossier,
  enrichJobIsSettled,
  findDealByCnpj,
  mergeDealPhones,
  reviewBriefingFromDossier,
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
      cnaeDescricao: "Marmoraria",
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

describe("attachCompanyHitToDeal", () => {
  it("keeps spreadsheet phones and fills an empty contact from the decisor", () => {
    const attached = attachCompanyHitToDeal(
      {
        contact_name: "",
        secretaries: [],
        phones: ["(54) 3289-2400"],
        people: [{ name: "", phone: "", email: "" }],
      },
      hit,
    );
    expect(attached.cnpj).toBe("12345678000190");
    expect(attached.contact_name).toBe("Ana Carvalho");
    expect(attached.phones[0]).toBe("(54) 3289-2400");
    expect(attached.phones).toContain("(34) 99999-0000");
  });
});

describe("reviewBriefingFromDossier", () => {
  it("builds a compact review with CNAE, place, phones and digital badges", () => {
    const briefing = reviewBriefingFromDossier({
      establishment: {
        cnpj: "12.345.678/0001-90",
        nome_fantasia: "Carvalho Pedras",
        uf: "MG",
      },
      company: { razao_social: "MARMORARIA CARVALHO LTDA" },
      cnaeDescricao: "Marmoraria",
      municipioNome: "Uberlândia",
      contacts: [
        {
          ddd: "34",
          telefone: "999990000",
          seal: "CONFIRMADO",
          sharedCount: 1,
          label: "Receita",
          source: "receita",
        },
      ],
      socios: [partner("Ana Carvalho")],
      decisor: {
        nome: "Ana Carvalho",
        qualificacao: "Sócio",
        dataEntrada: null,
        faixaEtaria: null,
      },
      enrichment: {
        domain_status: "encontrado",
        socials: { instagram: "https://instagram.com/x" },
        whatsapp: "5534999990000",
        gmb: { matched: true },
      } as LeadDossier["enrichment"],
    });
    expect(briefing.company).toBe("Carvalho Pedras");
    expect(briefing.cnpj).toBe("12345678000190");
    expect(briefing.municipio).toBe("Uberlândia");
    expect(briefing.uf).toBe("MG");
    expect(briefing.cnae).toBe("Marmoraria");
    expect(briefing.contact).toBe("Ana Carvalho");
    expect(briefing.phones).toEqual(["(34) 99999-0000"]);
    expect(briefing.badges.map((badge) => [badge.id, badge.found])).toEqual([
      ["site", true],
      ["instagram", true],
      ["whatsapp", true],
      ["gmb", true],
    ]);
  });

  it("falls back to search fields and empty badges when the dossier is thin", () => {
    const briefing = reviewBriefingFromDossier(
      {
        establishment: { cnpj: "12345678000190", nome_fantasia: null, uf: "" },
        company: { razao_social: "" },
        cnaeDescricao: "",
        municipioNome: "",
        contacts: [],
        socios: [],
        decisor: null,
        enrichment: null,
      },
      {
        company: "Carvalho Pedras",
        municipio: "Uberlândia",
        uf: "MG",
        cnae: "Marmoraria",
      },
    );
    expect(briefing.company).toBe("Carvalho Pedras");
    expect(briefing.municipio).toBe("Uberlândia");
    expect(briefing.uf).toBe("MG");
    expect(briefing.cnae).toBe("Marmoraria");
    expect(briefing.badges.every((badge) => !badge.found)).toBe(true);
  });
});

describe("enrichJobIsSettled", () => {
  it("treats pending and running as still in flight", () => {
    expect(enrichJobIsSettled("pending")).toBe(false);
    expect(enrichJobIsSettled("running")).toBe(false);
    expect(enrichJobIsSettled("done")).toBe(true);
    expect(enrichJobIsSettled(null)).toBe(true);
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

  it("accepts import and inbound sources", () => {
    expect(
      dealCreateSchema.parse({
        company_name: "Lead inbound",
        meta: { source: "import" },
      }).meta,
    ).toEqual({ source: "import" });
    expect(
      dealCreateSchema.parse({
        company_name: "Lead inbound",
        people: [{ name: "Maria", phone: "11981887766", email: "m@x.com" }],
        meta: { source: "inbound" },
      }).meta,
    ).toEqual({ source: "inbound" });
  });

  it("treats empty CNPJ as missing", () => {
    expect(dealCreateSchema.parse({ company_name: "X", cnpj: "" }).cnpj).toBeUndefined();
    expect(dealCreateSchema.parse({ company_name: "X", cnpj: null }).cnpj).toBeUndefined();
  });

  it("accepts an optional stage_id uuid", () => {
    const parsed = dealCreateSchema.parse({
      company_name: "Carvalho Pedras",
      stage_id: "2f1b8c3a-4d5e-6789-abcd-ef0123456789",
    });
    expect(parsed.stage_id).toBe("2f1b8c3a-4d5e-6789-abcd-ef0123456789");
  });

  it("rejects a non-uuid stage_id", () => {
    expect(() =>
      dealCreateSchema.parse({ company_name: "X", stage_id: "entrada" }),
    ).toThrow();
  });
});
