import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const applyImportLeads = vi.hoisted(() => vi.fn());
const getCrmBoard = vi.hoisted(() => vi.fn());
const searchCompanies = vi.hoisted(() => vi.fn());
const classifyEnrichmentCnpjs = vi.hoisted(() => vi.fn());
const createSavedCnpjList = vi.hoisted(() => vi.fn());
const createCrmPipeline = vi.hoisted(() => vi.fn());
const createCrmImportRun = vi.hoisted(() => vi.fn());
const listCrmImportRuns = vi.hoisted(() => vi.fn());
const enqueueEnrichment = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
  ENRICH_CREDIT_COST: 1,
  debitEnrich: vi.fn(),
  getBalance: vi.fn(),
}));

vi.mock("@/lib/crm/import-apply", () => ({
  applyImportLeads: (...args: unknown[]) => applyImportLeads(...args),
}));

vi.mock("@/lib/data", () => ({
  getDataSource: () => "mock",
  getRepo: () => ({
    getCrmBoard,
    searchCompanies,
    classifyEnrichmentCnpjs,
    createSavedCnpjList,
    createCrmPipeline,
    createCrmImportRun,
    listCrmImportRuns,
    enqueueEnrichment,
  }),
}));

import { GET, POST } from "./route";

const PIPELINE = "11111111-1111-4111-8111-111111111111";

describe("POST /api/crm/import", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    applyImportLeads.mockReset();
    getCrmBoard.mockReset();
    searchCompanies.mockReset();
    classifyEnrichmentCnpjs.mockReset();
    createSavedCnpjList.mockReset();
    createCrmPipeline.mockReset();
    createCrmImportRun.mockReset();
    listCrmImportRuns.mockReset();
    enqueueEnrichment.mockReset();
    getCrmBoard.mockResolvedValue({
      pipeline: { id: PIPELINE, nome: "Metal" },
      stages: [],
      deals: [],
    });
    searchCompanies.mockResolvedValue([]);
    createSavedCnpjList.mockResolvedValue(null);
  });

  it("returns 403 when CRM is locked", async () => {
    const { CrmNotAllowedError } = await import("@/lib/billing/types");
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await POST(
      new Request("http://localhost/api/crm/import", {
        method: "POST",
        body: JSON.stringify({
          pipeline_id: PIPELINE,
          rows: [{ name: "Maria" }],
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(applyImportLeads).not.toHaveBeenCalled();
  });

  it("imports mapped rows", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    applyImportLeads.mockResolvedValue({
      created: 1,
      skipped: 0,
      errors: [],
      issues: [],
      deals: [{ id: "d1", created: true }],
    });
    const res = await POST(
      new Request("http://localhost/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: PIPELINE,
          rows: [{ name: "Maria", email: "m@x.com" }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ created: 1, skipped: 0 });
    expect(applyImportLeads).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        source: "import",
      }),
    );
    expect(createCrmImportRun).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        pipelineId: PIPELINE,
        created: 1,
        skipped: 0,
        errorCount: 0,
      }),
    );
  });

  it("lists recent import runs", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    listCrmImportRuns.mockResolvedValue([
      {
        id: "r1",
        user_id: "u1",
        pipeline_id: PIPELINE,
        pipeline_nome: "Metal",
        file_name: "leads.csv",
        created: 2,
        skipped: 1,
        error_count: 0,
        matched_cnpjs: 2,
        list_id: null,
        qualified: 0,
        issues: [],
        created_at: "2026-09-05T12:00:00.000Z",
      },
    ]);
    const res = await GET(new Request("http://localhost/api/crm/import"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      runs: [
        expect.objectContaining({
          id: "r1",
          file_name: "leads.csv",
          created: 2,
          skipped: 1,
        }),
      ],
    });
  });
});
