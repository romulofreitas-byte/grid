import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const assertAutomationsAccess = vi.hoisted(() => vi.fn());
const getCrmInboundEndpointById = vi.hoisted(() => vi.fn());
const listCrmInboundEvents = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
  assertAutomationsAccess: (...args: unknown[]) => assertAutomationsAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ getCrmInboundEndpointById, listCrmInboundEvents }),
}));

import { GET } from "./route";

const ENDPOINT = "33333333-3333-4333-8333-333333333333";

describe("GET /api/crm/inbound/[endpointId]/events", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    assertAutomationsAccess.mockReset();
    getCrmInboundEndpointById.mockReset();
    listCrmInboundEvents.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true, plano: "piloto_pro" });
    assertAutomationsAccess.mockResolvedValue({
      enrichAllowed: true,
      plano: "piloto_pro",
    });
  });

  it("returns the last posts for a campaign the account owns", async () => {
    getCrmInboundEndpointById.mockResolvedValue({ id: ENDPOINT, user_id: "u1" });
    listCrmInboundEvents.mockResolvedValue([
      {
        id: "ev1",
        endpoint_id: ENDPOINT,
        user_id: "u1",
        status: "error",
        http_status: 400,
        message: "Linha vazia",
        deal_id: null,
        snapshot: { company: "", name: "", phone: "", email: "", cnpj: "" },
        payload: null,
        created_at: "2026-09-05T12:00:00.000Z",
      },
    ]);
    const res = await GET(
      new Request(`http://localhost/api/crm/inbound/${ENDPOINT}/events`),
      { params: Promise.resolve({ endpointId: ENDPOINT }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      events: [{ status: "error", message: "Linha vazia" }],
    });
  });
});
