import { describe, expect, it, vi } from "vitest";
import { bridgeQualifiedLeadsToCrm, type CrmBridgeRepo } from "./bridge";
import type { CrmDealCard, CrmPipeline, CrmPipelineSummary } from "./types";
import type { LeadDossier, Search } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";

function search(patch: Partial<Search> = {}): Search {
  return {
    id: "search-1",
    user_id: "user-1",
    nome: "Lista · Clínicas",
    filtros: {
      ...DEFAULT_FILTERS,
      segmentIds: ["seg-1"],
      ufs: ["MG"],
      municipioIds: [3106200],
    },
    total_found: 1,
    created_at: new Date().toISOString(),
    saved: true,
    ...patch,
  };
}

describe("bridgeQualifiedLeadsToCrm", () => {
  it("no-ops when the list is not saved", async () => {
    const repo = {
      listCrmPipelines: vi.fn(),
      createCrmPipeline: vi.fn(),
      isCrmPipelineNameBlocked: vi.fn().mockResolvedValue(false),
      findCrmDealByCnpj: vi.fn(),
      createCrmDeal: vi.fn(),
      getDossier: vi.fn(),
      listCompanyBriefs: vi.fn(),
      listHiddenPhones: vi.fn().mockResolvedValue(new Map()),
    } satisfies CrmBridgeRepo;

    const out = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search({ saved: false }),
      cnpjs: ["12345678000190"],
    });
    expect(out.created).toBe(0);
    expect(repo.createCrmDeal).not.toHaveBeenCalled();
  });

  it("names the pipeline after the list and opens another on the next send", async () => {
    const pipeline: CrmPipelineSummary = {
      id: "pipe-1",
      user_id: "user-1",
      nome: "Clínicas estética",
      position: 0,
      created_at: new Date().toISOString(),
      deal_count: 0,
    };
    const deal: CrmDealCard = {
      id: "deal-1",
      pipeline_id: pipeline.id,
      stage_id: "stage-1",
      company_name: "Clínica X",
      contact_name: "Ana",
      secretaries: [],
      people: [{ name: "Ana", phone: "", email: "" }],
      phones: ["(31) 99999-0000"],
      notes: "",
      cnpj: "12345678000190",
      meta: { source: "qualify_bridge" },
      outcome: "open",
      amount_cents: null,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      next_activity: null,
      open_activities: [],
    };

    const createCrmDeal = vi
      .fn()
      .mockResolvedValueOnce(deal)
      .mockResolvedValueOnce(deal);
    const findCrmDealByCnpj = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(deal)
      .mockResolvedValueOnce(null);
    const createdPipelines: CrmPipelineSummary[] = [];
    const createCrmPipeline = vi.fn(async (_userId: string, nome: string) => {
      const row: CrmPipelineSummary = {
        ...pipeline,
        id: `pipe-${createdPipelines.length + 1}`,
        nome,
      };
      createdPipelines.push(row);
      return row as CrmPipeline;
    });

    const repo: CrmBridgeRepo = {
      listCrmPipelines: vi.fn(async () => [...createdPipelines]),
      createCrmPipeline,
      isCrmPipelineNameBlocked: vi.fn().mockResolvedValue(false),
      findCrmDealByCnpj,
      createCrmDeal,
      getDossier: vi.fn().mockResolvedValue({
        establishment: {
          nome_fantasia: "Clínica X",
          cnpj: "12345678000190",
        },
        company: { razao_social: "CLINICA X LTDA" },
        decisor: { nome: "Ana" },
        contacts: [{ ddd: "31", telefone: "999990000" }],
      } as unknown as LeadDossier),
      listCompanyBriefs: vi.fn().mockResolvedValue([]),
      listHiddenPhones: vi.fn().mockResolvedValue(new Map()),
    };

    const first = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search(),
      cnpjs: ["12345678000190", "12345678000190"],
    });
    expect(first.created).toBe(1);
    expect(first.skipped).toBe(1);
    expect(first.pipelineNome).toBe("Lista · Clínicas");
    expect(createCrmPipeline).toHaveBeenCalledWith("user-1", "Lista · Clínicas");
    expect(createCrmDeal).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        pipelineId: "pipe-1",
        cnpj: "12345678000190",
        meta: expect.objectContaining({
          searchId: "search-1",
          ufs: ["MG"],
          source: "qualify_bridge",
        }),
      }),
    );

    const second = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search(),
      cnpjs: ["12345678000190"],
    });
    expect(second.created).toBe(1);
    expect(second.skipped).toBe(0);
    expect(second.failed).toBe(0);
    expect(second.pipelineNome).toBe("Lista · Clínicas 2");
    expect(createCrmPipeline).toHaveBeenLastCalledWith(
      "user-1",
      "Lista · Clínicas 2",
    );
    expect(createCrmDeal).toHaveBeenCalledTimes(2);
  });

  it("creates deals from company briefs when dossier is missing", async () => {
    const pipeline: CrmPipelineSummary = {
      id: "pipe-1",
      user_id: "user-1",
      nome: "Clínicas estética",
      position: 0,
      created_at: new Date().toISOString(),
      deal_count: 0,
    };
    const createCrmDeal = vi.fn().mockImplementation(
      async (_userId: string, input: { cnpj: string }) =>
        ({
          id: `deal-${input.cnpj}`,
          pipeline_id: pipeline.id,
          stage_id: "stage-1",
          company_name: "X",
          contact_name: "",
          secretaries: [],
          people: [{ name: "", phone: "", email: "" }],
          phones: [],
          notes: "",
          cnpj: input.cnpj,
          meta: { source: "qualify_bridge" },
          outcome: "open",
          amount_cents: null,
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          next_activity: null,
      open_activities: [],
        }) satisfies CrmDealCard,
    );
    const cnpjs = Array.from({ length: 50 }, (_, i) =>
      String(i + 1).padStart(14, "0"),
    );
    const repo: CrmBridgeRepo = {
      listCrmPipelines: vi.fn().mockResolvedValue([] as CrmPipelineSummary[]),
      createCrmPipeline: vi.fn().mockResolvedValue(pipeline as CrmPipeline),
      isCrmPipelineNameBlocked: vi.fn().mockResolvedValue(false),
      findCrmDealByCnpj: vi.fn().mockResolvedValue(null),
      createCrmDeal,
      getDossier: vi.fn().mockResolvedValue(null),
      listCompanyBriefs: vi.fn().mockResolvedValue(
        cnpjs.map((cnpj) => ({
          cnpj,
          razaoSocial: `EMPRESA ${cnpj}`,
          nomeFantasia: null,
          ddd1: "31",
          telefone1: "33334444",
          decisorNome: null,
        })),
      ),
      listHiddenPhones: vi.fn().mockResolvedValue(new Map()),
    };

    const out = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search(),
      cnpjs,
    });
    expect(out.created).toBe(50);
    expect(repo.getDossier).not.toHaveBeenCalled();
  });

  it("names a CNPJ-only list after the saved title, not the CNAE", async () => {
    const pipeline: CrmPipelineSummary = {
      id: "pipe-default",
      user_id: "user-1",
      nome: "Padaria do Zé",
      position: 0,
      created_at: new Date().toISOString(),
      deal_count: 0,
    };
    const createCrmPipeline = vi.fn(async (_userId: string, nome: string) => ({
      ...pipeline,
      nome,
    }));
    const createCrmDeal = vi.fn().mockResolvedValue({
      id: "deal-avulsa",
      pipeline_id: pipeline.id,
      stage_id: "stage-1",
      company_name: "Padaria do Zé",
      contact_name: "",
      secretaries: [],
      people: [{ name: "", phone: "", email: "" }],
      phones: [],
      notes: "",
      cnpj: "12345678000190",
      meta: { source: "qualify_bridge" },
      outcome: "open",
      amount_cents: null,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      next_activity: null,
      open_activities: [],
    } satisfies CrmDealCard);
    const repo: CrmBridgeRepo = {
      listCrmPipelines: vi.fn().mockResolvedValue([] as CrmPipelineSummary[]),
      createCrmPipeline,
      isCrmPipelineNameBlocked: vi.fn().mockResolvedValue(false),
      findCrmDealByCnpj: vi.fn().mockResolvedValue(null),
      createCrmDeal,
      getDossier: vi.fn().mockResolvedValue(null),
      listCompanyBriefs: vi.fn().mockResolvedValue([
        {
          cnpj: "12345678000190",
          razaoSocial: "PADARIA DO ZE LTDA",
          nomeFantasia: "Padaria do Zé",
          ddd1: "31",
          telefone1: "33334444",
          decisorNome: null,
        },
      ]),
      listHiddenPhones: vi.fn().mockResolvedValue(new Map()),
    };

    const out = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search({
        nome: "Padaria do Zé",
        filtros: {
          ...DEFAULT_FILTERS,
          cnpjs: ["12345678000190"],
          segmentIds: [],
          intentQuery: "Padaria e confeitaria",
        },
      }),
      cnpjs: ["12345678000190"],
    });
    expect(out.created).toBe(1);
    expect(out.pipelineNome).toBe("Padaria do Zé");
    expect(createCrmPipeline).toHaveBeenCalledWith("user-1", "Padaria do Zé");
  });

  it("counts missing company data as failed, not skipped", async () => {
    const pipeline: CrmPipelineSummary = {
      id: "pipe-1",
      user_id: "user-1",
      nome: "Clínicas estética",
      position: 0,
      created_at: new Date().toISOString(),
      deal_count: 0,
    };
    const repo: CrmBridgeRepo = {
      listCrmPipelines: vi.fn().mockResolvedValue([] as CrmPipelineSummary[]),
      createCrmPipeline: vi.fn().mockResolvedValue(pipeline as CrmPipeline),
      isCrmPipelineNameBlocked: vi.fn().mockResolvedValue(false),
      findCrmDealByCnpj: vi.fn().mockResolvedValue(null),
      createCrmDeal: vi.fn(),
      getDossier: vi.fn().mockResolvedValue(null),
      listCompanyBriefs: vi.fn().mockResolvedValue([]),
      listHiddenPhones: vi.fn().mockResolvedValue(new Map()),
    };
    const out = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search(),
      cnpjs: ["12345678000190"],
    });
    expect(out).toMatchObject({
      created: 0,
      skipped: 0,
      failed: 1,
      pipelineId: "pipe-1",
    });
    expect(repo.createCrmDeal).not.toHaveBeenCalled();
  });

  it("uses the next suffix when the list name was deleted", async () => {
    const createCrmPipeline = vi.fn(async (_userId: string, nome: string) => ({
      id: "pipe-2",
      user_id: "user-1",
      nome,
      position: 0,
      created_at: new Date().toISOString(),
      deal_count: 0,
    }));
    const repo: CrmBridgeRepo = {
      listCrmPipelines: vi.fn().mockResolvedValue([] as CrmPipelineSummary[]),
      createCrmPipeline,
      isCrmPipelineNameBlocked: vi.fn(
        async (_userId: string, nome: string) => nome === "Lista · Clínicas",
      ),
      findCrmDealByCnpj: vi.fn().mockResolvedValue(null),
      createCrmDeal: vi.fn(),
      getDossier: vi.fn().mockResolvedValue(null),
      listCompanyBriefs: vi.fn().mockResolvedValue([]),
      listHiddenPhones: vi.fn().mockResolvedValue(new Map()),
    };
    const out = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search(),
      cnpjs: ["12345678000190"],
    });
    expect(createCrmPipeline).toHaveBeenCalledWith(
      "user-1",
      "Lista · Clínicas 2",
    );
    expect(out.pipelineNome).toBe("Lista · Clínicas 2");
    expect(out.pipelineId).toBe("pipe-2");
  });
});
