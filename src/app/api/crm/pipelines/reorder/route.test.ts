import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const reorderCrmPipelines = vi.hoisted(() => vi.fn());
const listCrmPipelines = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ reorderCrmPipelines, listCrmPipelines }),
}));

import { POST } from "./route";

const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
] as const;

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/crm/pipelines/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/crm/pipelines/reorder", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    reorderCrmPipelines.mockReset();
    listCrmPipelines.mockReset();
  });

  it("returns 403 on Treino livre", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await post({ pipelineIds: [...IDS] });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "plan_required" });
    expect(reorderCrmPipelines).not.toHaveBeenCalled();
  });

  it("persists the order and returns the list", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    reorderCrmPipelines.mockResolvedValue(true);
    const pipelines = [
      { id: IDS[1], nome: "B", position: 0 },
      { id: IDS[0], nome: "A", position: 1 },
    ];
    listCrmPipelines.mockResolvedValue(pipelines);
    const res = await post({ pipelineIds: [IDS[1], IDS[0]] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pipelines });
    expect(reorderCrmPipelines).toHaveBeenCalledWith("u1", [IDS[1], IDS[0]]);
    expect(listCrmPipelines).toHaveBeenCalledWith("u1");
  });

  it("rejects an incomplete reorder", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    reorderCrmPipelines.mockResolvedValue(false);
    const res = await post({ pipelineIds: [...IDS] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Não foi possível reordenar os nichos.",
    });
    expect(listCrmPipelines).not.toHaveBeenCalled();
  });
});
