import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const getCrmInboundEndpoint = vi.hoisted(() => vi.fn());
const upsertCrmInboundEndpoint = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({
    getCrmInboundEndpoint,
    upsertCrmInboundEndpoint,
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
import { GET, POST } from "./route";

describe("crm inbound endpoint API", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    getCrmInboundEndpoint.mockReset();
    upsertCrmInboundEndpoint.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
  });

  it("returns null when the piloto has no inbox yet", async () => {
    getCrmInboundEndpoint.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/crm/inbound"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      endpoint: null,
      url: "http://localhost/api/webhooks/leads",
    });
  });

  it("creates a token on first save", async () => {
    getCrmInboundEndpoint.mockResolvedValue(null);
    upsertCrmInboundEndpoint.mockResolvedValue({
      id: "e1",
      user_id: "u1",
      pipeline_id: "11111111-1111-4111-8111-111111111111",
      stage_id: null,
      token_hash: hashInboundToken("test-token"),
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const res = await POST(
      new Request("http://localhost/api/crm/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe("test-token");
    expect(upsertCrmInboundEndpoint).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        token_hash: hashInboundToken("test-token"),
      }),
    );
  });
});
