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
      findCrmDealByCnpj: vi.fn(),
      createCrmDeal: vi.fn(),
      getDossier: vi.fn(),
      listCompanyBriefs: vi.fn(),
      getPreset: vi.fn(),
    } satisfies CrmBridgeRepo;

    const out = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search({ saved: false }),
      cnpjs: ["12345678000190"],
    });
    expect(out.created).toBe(0);
    expect(repo.createCrmDeal).not.toHaveBeenCalled();
  });

  it("creates a niche pipeline deal and skips duplicates", async () => {
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
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      next_activity: null,
    };

    const createCrmDeal = vi
      .fn()
      .mockResolvedValueOnce(deal)
      .mockResolvedValueOnce(deal);
    const findCrmDealByCnpj = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(deal);

    const repo: CrmBridgeRepo = {
      listCrmPipelines: vi.fn().mockResolvedValue([] as CrmPipelineSummary[]),
      createCrmPipeline: vi.fn().mockResolvedValue(pipeline as CrmPipeline),
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
      getPreset: vi.fn().mockResolvedValue({
        id: "seg-1",
        nome: "Clínicas estética",
      }),
    };

    const first = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search(),
      cnpjs: ["12345678000190"],
    });
    expect(first.created).toBe(1);
    expect(first.pipelineNome).toBe("Clínicas estética");
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
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(createCrmDeal).toHaveBeenCalledTimes(1);
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
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          next_activity: null,
        }) satisfies CrmDealCard,
    );
    const cnpjs = Array.from({ length: 50 }, (_, i) =>
      String(i + 1).padStart(14, "0"),
    );
    const repo: CrmBridgeRepo = {
      listCrmPipelines: vi.fn().mockResolvedValue([] as CrmPipelineSummary[]),
      createCrmPipeline: vi.fn().mockResolvedValue(pipeline as CrmPipeline),
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
      getPreset: vi.fn().mockResolvedValue({
        id: "seg-1",
        nome: "Clínicas estética",
      }),
    };

    const out = await bridgeQualifiedLeadsToCrm(repo, {
      userId: "user-1",
      search: search(),
      cnpjs,
    });
    expect(out.created).toBe(50);
    expect(repo.getDossier).not.toHaveBeenCalled();
  });

  it("lands a CNPJ-only avulsa list on Meu nicho instead of the CNAE name", async () => {
    const pipeline: CrmPipelineSummary = {
      id: "pipe-default",
      user_id: "user-1",
      nome: "Meu nicho",
      position: 0,
      created_at: new Date().toISOString(),
      deal_count: 0,
    };
    const createCrmPipeline = vi.fn().mockResolvedValue(pipeline as CrmPipeline);
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
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      next_activity: null,
    } satisfies CrmDealCard);
    const repo: CrmBridgeRepo = {
      listCrmPipelines: vi.fn().mockResolvedValue([] as CrmPipelineSummary[]),
      createCrmPipeline,
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
      getPreset: vi.fn().mockResolvedValue(null),
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
    expect(out.pipelineNome).toBe("Meu nicho");
    expect(createCrmPipeline).toHaveBeenCalledWith("user-1", "Meu nicho");
  });
});
