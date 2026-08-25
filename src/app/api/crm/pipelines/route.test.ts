import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const listCrmPipelines = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ listCrmPipelines }),
}));

import { GET } from "./route";

describe("GET /api/crm/pipelines", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    listCrmPipelines.mockReset();
  });

  it("returns 403 on Treino livre", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await GET(new Request("http://localhost/api/crm/pipelines"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "plan_required" });
    expect(listCrmPipelines).not.toHaveBeenCalled();
  });

  it("lists pipelines when the plan allows CRM", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    listCrmPipelines.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/crm/pipelines"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pipelines: [] });
    expect(listCrmPipelines).toHaveBeenCalledWith("u1");
  });
});
