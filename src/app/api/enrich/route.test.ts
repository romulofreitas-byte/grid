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
const getSearch = vi.hoisted(() => vi.fn());
const classifyEnrichmentCnpjs = vi.hoisted(() => vi.fn());
const drainJobsIfMock = vi.hoisted(() => vi.fn());
const resolveJobScoreProfile = vi.hoisted(() => vi.fn());
const bridgeQualifiedLeadsToCrm = vi.hoisted(() => vi.fn());

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
    getPreset: vi.fn(),
    listUnauditedCnpjs: vi.fn(),
    classifyEnrichmentCnpjs,
  }),
}));

vi.mock("@/lib/enrichment/process-job", () => ({
  drainJobsIfMock: (...args: unknown[]) => drainJobsIfMock(...args),
  resolveJobScoreProfile: (...args: unknown[]) => resolveJobScoreProfile(...args),
}));

vi.mock("@/lib/crm/bridge", () => ({
  bridgeQualifiedLeadsToCrm,
}));

import { POST } from "./route";

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
    expect(await res.json()).toMatchObject({ recrawl: true, queued: 1 });
    expect(enqueueEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          action: "confirm",
          domain: "novo.com.br",
        }),
      }),
    );
    expect(upsertEnrichment).not.toHaveBeenCalled();
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

  it("returns 409 when a qualify job is already running", async () => {
    getLatestEnrichmentJob.mockResolvedValue({ status: "running" });
    const res = await POST(
      correctRequest({
        cnpjs: ["00000000000000"],
        action: "confirm",
        domain: "granexpo.com.br",
      }),
    );
    expect(res.status).toBe(409);
    expect(upsertEnrichment).not.toHaveBeenCalled();
  });
});

describe("POST /api/enrich qualify bridge", () => {
  beforeEach(() => {
    guardApi.mockReset();
    getSearch.mockReset();
    classifyEnrichmentCnpjs.mockReset();
    enqueueEnrichment.mockReset();
    drainJobsIfMock.mockReset();
    bridgeQualifiedLeadsToCrm.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    classifyEnrichmentCnpjs.mockResolvedValue({
      chargeable: [],
      skippedOptOut: 0,
    });
    enqueueEnrichment.mockResolvedValue({ queued: 1, skippedOptOut: 0 });
  });

  it("awaits the CRM bridge and returns the real pipelineId", async () => {
    getSearch.mockResolvedValue({
      id: "s1",
      user_id: "u1",
      saved: true,
      nome: "Padaria do Zé",
      filtros: { cnpjs: ["00000000000000"], segmentIds: [] },
    });
    bridgeQualifiedLeadsToCrm.mockResolvedValue({
      created: 1,
      skipped: 0,
      pipelineId: "pipe-1",
      pipelineNome: "Meu nicho",
    });
    const res = await POST(
      correctRequest({
        searchId: "s1",
        cnpjs: ["00000000000000"],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      queued: 1,
      crmBridge: {
        created: 1,
        pipelineId: "pipe-1",
        pipelineNome: "Meu nicho",
      },
      crmPending: true,
    });
    expect(bridgeQualifiedLeadsToCrm).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "u1",
        cnpjs: ["00000000000000"],
      }),
    );
  });
});
