import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const listCrmStages = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ listCrmStages }),
}));

import { GET } from "./route";

describe("GET /api/crm/pipelines/[pipelineId]/stages", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    listCrmStages.mockReset();
  });

  it("returns 403 on Treino livre", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await GET(new Request("http://localhost/api/crm/pipelines/p1/stages"), {
      params: Promise.resolve({ pipelineId: "p1" }),
    });
    expect(res.status).toBe(403);
    expect(listCrmStages).not.toHaveBeenCalled();
  });

  it("returns stages without loading deals", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    listCrmStages.mockResolvedValue([{ id: "s1", nome: "Entrada" }]);
    const res = await GET(new Request("http://localhost/api/crm/pipelines/p1/stages"), {
      params: Promise.resolve({ pipelineId: "p1" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stages: [{ id: "s1", nome: "Entrada" }] });
    expect(listCrmStages).toHaveBeenCalledWith("u1", "p1");
  });

  it("returns 404 when the pipeline is missing", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    listCrmStages.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/crm/pipelines/p1/stages"), {
      params: Promise.resolve({ pipelineId: "p1" }),
    });
    expect(res.status).toBe(404);
  });
});
