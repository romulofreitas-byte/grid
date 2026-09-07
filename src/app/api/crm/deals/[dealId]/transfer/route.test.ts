import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const transferCrmDeal = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ transferCrmDeal }),
}));

import { POST } from "./route";

describe("POST /api/crm/deals/[dealId]/transfer", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    transferCrmDeal.mockReset();
  });

  it("transfers the deal when CRM is allowed", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    transferCrmDeal.mockResolvedValue({
      deal: { id: "d1", pipeline_id: "p2" },
      fromPipelineId: "p1",
      fromDealId: "d1",
      merged: false,
    });
    const res = await POST(
      new Request("http://localhost/api/crm/deals/d1/transfer", {
        method: "POST",
        body: JSON.stringify({
          pipelineId: "11111111-1111-4111-8111-111111111111",
        }),
      }),
      { params: Promise.resolve({ dealId: "d1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.merged).toBe(false);
    expect(transferCrmDeal).toHaveBeenCalledWith(
      "u1",
      "d1",
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("returns 403 when CRM is locked", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await POST(
      new Request("http://localhost/api/crm/deals/d1/transfer", {
        method: "POST",
        body: JSON.stringify({
          pipelineId: "11111111-1111-4111-8111-111111111111",
        }),
      }),
      { params: Promise.resolve({ dealId: "d1" }) },
    );
    expect(res.status).toBe(403);
  });
});
