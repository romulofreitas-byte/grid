import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const assertAutomationsAccess = vi.hoisted(() => vi.fn());
const listCrmInboundEndpoints = vi.hoisted(() => vi.fn());
const listCrmInboundLastEvents = vi.hoisted(() => vi.fn());
const createCrmInboundEndpoint = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
  assertAutomationsAccess: (...args: unknown[]) => assertAutomationsAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({
    listCrmInboundEndpoints,
    listCrmInboundLastEvents,
    createCrmInboundEndpoint,
  }),
}));

vi.mock("@/lib/crm/inbound-token", async () => {
  const actual = await vi.importActual<typeof import("@/lib/crm/inbound-token")>(
    "@/lib/crm/inbound-token",
  );
  return {
    ...actual,
    generateInboundToken: () => "test-token",
  };
});

import { hashInboundToken } from "@/lib/crm/inbound-token";
import { AutomationsNotAllowedError } from "@/lib/billing/types";
import { GET, POST } from "./route";

const PIPELINE = "11111111-1111-4111-8111-111111111111";

describe("crm inbound endpoint API", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    assertAutomationsAccess.mockReset();
    listCrmInboundEndpoints.mockReset();
    listCrmInboundLastEvents.mockReset();
    createCrmInboundEndpoint.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true, plano: "piloto_pro" });
    assertAutomationsAccess.mockResolvedValue({
      enrichAllowed: true,
      plano: "piloto_pro",
    });
    listCrmInboundLastEvents.mockResolvedValue([]);
  });

  it("returns an empty list when the account has no campaign yet", async () => {
    listCrmInboundEndpoints.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/crm/inbound"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      endpoints: [],
      limit: 10,
    });
  });

  it("creates a token on first save", async () => {
    listCrmInboundEndpoints.mockResolvedValue([]);
    createCrmInboundEndpoint.mockResolvedValue({
      id: "e1",
      user_id: "u1",
      pipeline_id: PIPELINE,
      stage_id: null,
      nome: "Site",
      lead_kind: "company",
      channel: "site",
      token_hash: hashInboundToken("test-token"),
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const res = await POST(
      new Request("http://localhost/api/crm/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Site",
          pipeline_id: PIPELINE,
          lead_kind: "company",
          channel: "site",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe("test-token");
    expect(body.endpoint.url).toBe("http://localhost/api/webhooks/leads/e1");
    expect(createCrmInboundEndpoint).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        token_hash: hashInboundToken("test-token"),
        nome: "Site",
        lead_kind: "company",
      }),
    );
  });

  it("rejects an 11th campaign", async () => {
    listCrmInboundEndpoints.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ id: `e${i}` })),
    );
    const res = await POST(
      new Request("http://localhost/api/crm/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Extra",
          pipeline_id: PIPELINE,
          lead_kind: "company",
          channel: "site",
        }),
      }),
    );
    expect(res.status).toBe(400);
    expect(createCrmInboundEndpoint).not.toHaveBeenCalled();
  });

  it("rejects listing when the plan is Piloto", async () => {
    assertAutomationsAccess.mockRejectedValue(new AutomationsNotAllowedError());
    const res = await GET(new Request("http://localhost/api/crm/inbound"));
    expect(res.status).toBe(403);
    expect(listCrmInboundEndpoints).not.toHaveBeenCalled();
  });
});
