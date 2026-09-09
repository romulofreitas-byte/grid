import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const applyCrmCadenceToOthers = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ applyCrmCadenceToOthers }),
}));

import { POST } from "./route";

describe("POST /api/crm/pipelines/[pipelineId]/cadence/apply", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    applyCrmCadenceToOthers.mockReset();
  });

  it("returns 403 on Treino livre", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await POST(
      new Request("http://localhost/api/crm/pipelines/p1/cadence/apply", {
        method: "POST",
      }),
      { params: Promise.resolve({ pipelineId: "p1" }) },
    );
    expect(res.status).toBe(403);
    expect(applyCrmCadenceToOthers).not.toHaveBeenCalled();
  });

  it("applies the source cadence to other pipelines", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    applyCrmCadenceToOthers.mockResolvedValue({ applied: 2 });
    const res = await POST(
      new Request("http://localhost/api/crm/pipelines/p1/cadence/apply", {
        method: "POST",
      }),
      { params: Promise.resolve({ pipelineId: "p1" }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: 2 });
    expect(applyCrmCadenceToOthers).toHaveBeenCalledWith("u1", "p1");
  });

  it("returns 404 when the pipeline is missing", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    applyCrmCadenceToOthers.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/crm/pipelines/missing/cadence/apply", {
        method: "POST",
      }),
      { params: Promise.resolve({ pipelineId: "missing" }) },
    );
    expect(res.status).toBe(404);
  });
});
