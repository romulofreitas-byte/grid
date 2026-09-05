import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const searchCrmDeals = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ searchCrmDeals }),
}));

import { GET } from "./route";

describe("GET /api/crm/deals/search", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    searchCrmDeals.mockReset();
  });

  it("returns 403 when CRM is not on the plan", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await GET(
      new Request("http://localhost/api/crm/deals/search?q=padaria"),
    );
    expect(res.status).toBe(403);
    expect(searchCrmDeals).not.toHaveBeenCalled();
  });

  it("searches deals for the signed-in user", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    searchCrmDeals.mockResolvedValue([]);
    const res = await GET(
      new Request(
        "http://localhost/api/crm/deals/search?q=padaria&pipeline=a1000000-0000-4000-8000-000000000001",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hits: [] });
    expect(searchCrmDeals).toHaveBeenCalledWith("u1", "padaria", {
      preferredPipelineId: "a1000000-0000-4000-8000-000000000001",
    });
  });
});
