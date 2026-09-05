import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const getCrmImportRun = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ getCrmImportRun }),
}));

import { GET } from "./route";

const RUN = "22222222-2222-4222-8222-222222222222";

describe("GET /api/crm/import/[runId]", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    getCrmImportRun.mockReset();
  });

  it("returns the issues for a run the piloto owns", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    getCrmImportRun.mockResolvedValue({
      id: RUN,
      user_id: "u1",
      pipeline_id: "11111111-1111-4111-8111-111111111111",
      pipeline_nome: "Metal",
      file_name: "leads.csv",
      created: 1,
      skipped: 0,
      error_count: 1,
      matched_cnpjs: 0,
      list_id: null,
      qualified: 0,
      issues: [
        {
          row: 2,
          status: "error",
          message: "CNPJ inválido",
          company: "Oficina",
          name: "",
          phone: "",
          email: "",
          cnpj: "123",
        },
      ],
      created_at: "2026-09-05T12:00:00.000Z",
    });
    const res = await GET(new Request(`http://localhost/api/crm/import/${RUN}`), {
      params: Promise.resolve({ runId: RUN }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      run: { id: RUN, error_count: 1, issues: [{ row: 2, message: "CNPJ inválido" }] },
    });
  });

  it("returns 404 for an unknown id", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    getCrmImportRun.mockResolvedValue(null);
    const res = await GET(new Request(`http://localhost/api/crm/import/${RUN}`), {
      params: Promise.resolve({ runId: RUN }),
    });
    expect(res.status).toBe(404);
  });
});
