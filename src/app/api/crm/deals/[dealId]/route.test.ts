import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const getCrmDeal = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ getCrmDeal }),
}));

import { GET } from "./route";

describe("GET /api/crm/deals/[dealId]", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    getCrmDeal.mockReset();
  });

  it("returns 403 on Treino livre", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await GET(new Request("http://localhost/api/crm/deals/d1"), {
      params: Promise.resolve({ dealId: "d1" }),
    });
    expect(res.status).toBe(403);
    expect(getCrmDeal).not.toHaveBeenCalled();
  });

  it("returns the deal card", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    getCrmDeal.mockResolvedValue({ id: "d1", company_name: "Metalúrgica" });
    const res = await GET(new Request("http://localhost/api/crm/deals/d1"), {
      params: Promise.resolve({ dealId: "d1" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      deal: { id: "d1", company_name: "Metalúrgica" },
    });
    expect(getCrmDeal).toHaveBeenCalledWith("u1", "d1");
  });

  it("returns 404 when the deal is missing", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    getCrmDeal.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/crm/deals/d1"), {
      params: Promise.resolve({ dealId: "d1" }),
    });
    expect(res.status).toBe(404);
  });
});
