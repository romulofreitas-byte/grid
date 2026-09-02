import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { LeadEnrichment, TechSignals } from "@/lib/types";

const guardApi = vi.hoisted(() => vi.fn());
const isCnpjBilled = vi.hoisted(() => vi.fn());
const getEnrichment = vi.hoisted(() => vi.fn());
const getLatestEnrichmentJob = vi.hoisted(() => vi.fn());
const upsertEnrichment = vi.hoisted(() => vi.fn());
const enqueueEnrichment = vi.hoisted(() => vi.fn());
const setDomainCache = vi.hoisted(() => vi.fn());
const skipActiveEnrichmentJobs = vi.hoisted(() => vi.fn());
const getSearch = vi.hoisted(() => vi.fn());
const classifyEnrichmentCnpjs = vi.hoisted(() => vi.fn());
const listUnauditedCnpjs = vi.hoisted(() => vi.fn());
const listEnrichmentJobs = vi.hoisted(() => vi.fn());
const drainJobsIfMock = vi.hoisted(() => vi.fn());
const processOwnedEnrichmentJobs = vi.hoisted(() => vi.fn());
const resolveJobScoreProfile = vi.hoisted(() => vi.fn());
const bridgeQualifiedLeadsToCrm = vi.hoisted(() => vi.fn());
const getDataSource = vi.hoisted(() => vi.fn(() => "mock"));
const after = vi.hoisted(() =>
  vi.fn((cb: () => unknown) => {
    void cb();
  }),
);

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after };
});

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  debitEnrich: vi.fn(),
  getBalance: vi.fn(),
  getBillingStore: () => ({ isCnpjBilled }),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({
    getSearch,
    getEnrichment,
    getLatestEnrichmentJob,
    upsertEnrichment,
    enqueueEnrichment,
    setDomainCache,
    skipActiveEnrichmentJobs,
    getPreset: vi.fn(),
    listUnauditedCnpjs,
    listEnrichmentJobs,
    classifyEnrichmentCnpjs,
  }),
  getDataSource,
}));

vi.mock("@/lib/enrichment/process-job", () => ({
  drainJobsIfMock: (...args: unknown[]) => drainJobsIfMock(...args),
  processOwnedEnrichmentJobs: (...args: unknown[]) =>
    processOwnedEnrichmentJobs(...args),
  resolveJobScoreProfile: (...args: unknown[]) => resolveJobScoreProfile(...args),
}));

vi.mock("@/lib/crm/bridge", () => ({
  bridgeQualifiedLeadsToCrm,
}));

import { GET, POST } from "./route";

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

function completeRow(): LeadEnrichment {
  return {
    cnpj: "00000000000000",
    domain: "exemplo.com.br",
    domain_status: "confirmado",
    http_status: 200,
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
    stage: "complete",
    collected_at: "2026-08-13T12:00:00.000Z",
    expires_at: "2026-09-12T12:00:00.000Z",
  };
}

function correctRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/enrich action=correct", () => {
  beforeEach(() => {
    guardApi.mockReset();
    isCnpjBilled.mockReset();
    getEnrichment.mockReset();
    getLatestEnrichmentJob.mockReset();
    upsertEnrichment.mockReset();
    enqueueEnrichment.mockReset();
    setDomainCache.mockReset();
    skipActiveEnrichmentJobs.mockReset();
    skipActiveEnrichmentJobs.mockResolvedValue(0);
    getSearch.mockReset();
    classifyEnrichmentCnpjs.mockReset();
    drainJobsIfMock.mockReset();
    resolveJobScoreProfile.mockReset();
    bridgeQualifiedLeadsToCrm.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    isCnpjBilled.mockResolvedValue(true);
    getSearch.mockResolvedValue(undefined);
    getLatestEnrichmentJob.mockResolvedValue(null);
    getEnrichment.mockResolvedValue(completeRow());
    resolveJobScoreProfile.mockResolvedValue("b2c_local");
    enqueueEnrichment.mockResolvedValue({ queued: 1, skippedOptOut: 0 });
  });

  it("returns 400 when the CNPJ was not qualified", async () => {
    isCnpjBilled.mockResolvedValue(false);
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "correct",
        corrections: { instagram: "@acme" },
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: expect.stringMatching(/qualifique/i),
    });
    expect(upsertEnrichment).not.toHaveBeenCalled();
  });

  it("returns 400 when there is no complete audit", async () => {
    getEnrichment.mockResolvedValue(null);
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "correct",
        corrections: { instagram: "@acme" },
      }),
    );
    expect(res.status).toBe(400);
    expect(upsertEnrichment).not.toHaveBeenCalled();
  });

  it("returns 409 when a qualify job is already running", async () => {
    getLatestEnrichmentJob.mockResolvedValue({ status: "running" });
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "correct",
        corrections: { instagram: "@acme" },
      }),
    );
    expect(res.status).toBe(409);
    expect(upsertEnrichment).not.toHaveBeenCalled();
  });

  it("patches Instagram without enqueueing a crawl", async () => {
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "correct",
        corrections: { instagram: "@acme.br" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recrawl).toBe(false);
    expect(json.enrichment.socials.instagram).toBe(
      "https://instagram.com/acme.br",
    );
    expect(upsertEnrichment).toHaveBeenCalledOnce();
    expect(enqueueEnrichment).not.toHaveBeenCalled();
  });

  it("enqueues a confirm recrawl when the domain changes", async () => {
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "correct",
        corrections: { domain: "https://novo.com.br" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ recrawl: true, queued: 1 });
    expect(json.enrichment.domain).toBe("novo.com.br");
    expect(json.enrichment.domain_status).toBe("confirmado");
    expect(upsertEnrichment).toHaveBeenCalledOnce();
    expect(enqueueEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          action: "confirm",
          domain: "novo.com.br",
          refresh: true,
          homepagePath: null,
        }),
      }),
    );
  });

  it("keeps /home on a domain correction and supersedes a running job", async () => {
    getLatestEnrichmentJob.mockResolvedValue({ status: "running" });
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "correct",
        corrections: { domain: "https://www.produtosmarina.com.br/home/" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.enrichment.domain).toBe("produtosmarina.com.br");
    expect(json.enrichment.homepage_path).toBe("/home");
    expect(skipActiveEnrichmentJobs).toHaveBeenCalledWith("00000000000000");
    expect(enqueueEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          domain: "produtosmarina.com.br",
          homepagePath: "/home",
        }),
      }),
    );
  });
});

describe("POST /api/enrich action=confirm|reject", () => {
  beforeEach(() => {
    guardApi.mockReset();
    isCnpjBilled.mockReset();
    getEnrichment.mockReset();
    getLatestEnrichmentJob.mockReset();
    upsertEnrichment.mockReset();
    enqueueEnrichment.mockReset();
    setDomainCache.mockReset();
    skipActiveEnrichmentJobs.mockReset();
    skipActiveEnrichmentJobs.mockResolvedValue(0);
    getSearch.mockReset();
    drainJobsIfMock.mockReset();
    resolveJobScoreProfile.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    isCnpjBilled.mockResolvedValue(true);
    getSearch.mockResolvedValue(undefined);
    getLatestEnrichmentJob.mockResolvedValue(null);
    getEnrichment.mockResolvedValue({
      ...completeRow(),
      domain: "granexpo.com.br",
      domain_status: "nao_confirmado",
      http_status: 403,
    });
    resolveJobScoreProfile.mockResolvedValue("b2c_local");
    enqueueEnrichment.mockResolvedValue({ queued: 1, skippedOptOut: 0 });
  });

  it("patches the candidate to confirmado before enqueueing the harvest", async () => {
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "confirm",
        domain: "granexpo.com.br",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.enrichment.domain_status).toBe("confirmado");
    expect(json.enrichment.domain).toBe("granexpo.com.br");
    expect(json.recrawl).toBe(true);
    expect(upsertEnrichment).toHaveBeenCalledOnce();
    expect(setDomainCache).toHaveBeenCalledWith(
      "00000000",
      "granexpo.com.br",
      "confirmado",
    );
    expect(enqueueEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          action: "confirm",
          domain: "granexpo.com.br",
          refresh: true,
        }),
      }),
    );
  });

  it("drops a rejected candidate immediately and recrawls", async () => {
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "reject",
        domain: "granexpo.com.br",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.enrichment.domain).toBeNull();
    expect(json.enrichment.domain_status).toBe("nao_encontrado");
    expect(json.enrichment.discarded_domains).toContain("granexpo.com.br");
    expect(enqueueEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          action: "reject",
          domain: "granexpo.com.br",
          refresh: true,
        }),
      }),
    );
  });

  it("supersedes a running job instead of returning 409", async () => {
    getLatestEnrichmentJob.mockResolvedValue({ status: "running" });
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "confirm",
        domain: "granexpo.com.br",
      }),
    );
    expect(res.status).toBe(200);
    expect(skipActiveEnrichmentJobs).toHaveBeenCalledWith("00000000000000");
    expect(upsertEnrichment).toHaveBeenCalledOnce();
    expect(enqueueEnrichment).toHaveBeenCalled();
  });
});

describe("POST /api/enrich qualify bridge", () => {
  beforeEach(() => {
    guardApi.mockReset();
    getSearch.mockReset();
    classifyEnrichmentCnpjs.mockReset();
    listUnauditedCnpjs.mockReset();
    enqueueEnrichment.mockReset();
    drainJobsIfMock.mockReset();
    processOwnedEnrichmentJobs.mockReset();
    processOwnedEnrichmentJobs.mockResolvedValue(0);
    getDataSource.mockReset();
    getDataSource.mockReturnValue("mock");
    bridgeQualifiedLeadsToCrm.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    classifyEnrichmentCnpjs.mockResolvedValue({
      chargeable: [],
      skippedOptOut: 0,
    });
    enqueueEnrichment.mockResolvedValue({ queued: 1, skippedOptOut: 0 });
  });

  it("does not wait for the CRM bridge before responding", async () => {
    getSearch.mockResolvedValue({
      id: "s1",
      user_id: "u1",
      saved: true,
      nome: "Padaria do Zé",
      filtros: { cnpjs: ["00000000000000"], segmentIds: [] },
    });
    let resolveBridge!: (value: {
      created: number;
      skipped: number;
      pipelineId: string;
      pipelineNome: string;
    }) => void;
    bridgeQualifiedLeadsToCrm.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBridge = resolve;
        }),
    );
    const res = await POST(
      correctRequest({
        searchId: "s1",
        cnpjs: ["00000000000000"],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      queued: 1,
      crmBridge: null,
      crmPending: true,
    });
    expect(enqueueEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({ priority: true }),
    );
    expect(bridgeQualifiedLeadsToCrm).toHaveBeenCalled();
    resolveBridge({
      created: 1,
      skipped: 0,
      pipelineId: "pipe-1",
      pipelineNome: "Meu nicho",
    });
  });

  it("passes limit into listUnauditedCnpjs for Qualificar 10", async () => {
    getSearch.mockResolvedValue({
      id: "s1",
      user_id: "u1",
      saved: false,
      nome: "Lista",
      filtros: {},
    });
    listUnauditedCnpjs.mockResolvedValue(["00000000000001", "00000000000002"]);
    const res = await POST(
      correctRequest({
        searchId: "s1",
        scope: "first_unaudited",
        limit: 10,
      }),
    );
    expect(res.status).toBe(200);
    expect(listUnauditedCnpjs).toHaveBeenCalledWith("s1", { limit: 10 });
    expect(enqueueEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: true,
        cnpjs: ["00000000000001", "00000000000002"],
      }),
    );
  });

  it("enqueues the full list without interactive priority", async () => {
    getSearch.mockResolvedValue({
      id: "s1",
      user_id: "u1",
      saved: false,
      nome: "Lista",
      filtros: {},
    });
    listUnauditedCnpjs.mockResolvedValue(["00000000000001"]);
    await POST(
      correctRequest({
        searchId: "s1",
        scope: "all_unaudited",
      }),
    );
    expect(listUnauditedCnpjs).toHaveBeenCalledWith("s1", undefined);
    expect(enqueueEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({ priority: false }),
    );
  });

  it("starts owned enrichment on live after enqueue", async () => {
    getDataSource.mockReturnValue("supabase");
    getSearch.mockResolvedValue({
      id: "s1",
      user_id: "u1",
      saved: false,
      nome: "Lista",
      filtros: {},
    });
    await POST(
      correctRequest({
        searchId: "s1",
        cnpjs: ["00000000000000"],
      }),
    );
    expect(processOwnedEnrichmentJobs).toHaveBeenCalledWith("s1", "u1");
  });
});

describe("GET /api/enrich", () => {
  beforeEach(() => {
    guardApi.mockReset();
    getSearch.mockReset();
    listEnrichmentJobs.mockReset();
    processOwnedEnrichmentJobs.mockReset();
    processOwnedEnrichmentJobs.mockResolvedValue(0);
    getDataSource.mockReset();
    getDataSource.mockReturnValue("supabase");
    drainJobsIfMock.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
  });

  it("kicks owned jobs when this search still has pending work", async () => {
    getSearch.mockResolvedValue({
      id: "s1",
      user_id: "u1",
      saved: true,
      nome: "Lista",
      filtros: {},
    });
    listEnrichmentJobs.mockResolvedValue([
      { id: 1, cnpj: "1", status: "pending" },
    ]);
    const res = await GET(
      new Request("http://localhost/api/enrich?searchId=s1"),
    );
    expect(res.status).toBe(200);
    expect(processOwnedEnrichmentJobs).toHaveBeenCalledWith("s1", "u1");
  });
});
