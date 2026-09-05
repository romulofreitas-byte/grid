import { beforeEach, describe, expect, it, vi } from "vitest";

const guardPublicApi = vi.hoisted(() => vi.fn());
const getCrmInboundEndpointByTokenHash = vi.hoisted(() => vi.fn());
const findCrmInboundEndpoint = vi.hoisted(() => vi.fn());
const createCrmInboundEvent = vi.hoisted(() => vi.fn());
const applyOneImportLead = vi.hoisted(() => vi.fn());
const getBalance = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardPublicApi: (...args: unknown[]) => guardPublicApi(...args),
}));

vi.mock("@/lib/crm/import-apply", () => ({
  applyOneImportLead: (...args: unknown[]) => applyOneImportLead(...args),
}));

vi.mock("@/lib/billing/service", () => ({
  getBalance: (...args: unknown[]) => getBalance(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({
    getCrmInboundEndpointByTokenHash,
    findCrmInboundEndpoint,
    createCrmInboundEvent,
  }),
}));

import { hashInboundToken } from "@/lib/crm/inbound-token";
import { POST } from "./route";

describe("POST /api/webhooks/leads/:endpointId", () => {
  beforeEach(() => {
    guardPublicApi.mockReset();
    getCrmInboundEndpointByTokenHash.mockReset();
    findCrmInboundEndpoint.mockReset();
    createCrmInboundEvent.mockReset();
    applyOneImportLead.mockReset();
    getBalance.mockReset();
    guardPublicApi.mockResolvedValue(null);
    findCrmInboundEndpoint.mockResolvedValue(null);
    createCrmInboundEvent.mockResolvedValue(null);
    getBalance.mockResolvedValue({ plano: "piloto_pro", enrichAllowed: true });
  });

  it("rejects when the token belongs to another campaign", async () => {
    getCrmInboundEndpointByTokenHash.mockResolvedValue({
      id: "other",
      user_id: "u1",
      pipeline_id: "p1",
      stage_id: null,
      lead_kind: "company",
      channel: "site",
    });
    findCrmInboundEndpoint.mockResolvedValue({
      id: "wanted",
      user_id: "u1",
      pipeline_id: "p1",
      stage_id: null,
      nome: "Meta",
      lead_kind: "company",
      channel: "ads",
      token_hash: "x",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/leads/wanted", {
        method: "POST",
        headers: { Authorization: "Bearer good-token" },
        body: JSON.stringify({ kind: "company", company: "Roal" }),
      }),
      { params: Promise.resolve({ endpointId: "wanted" }) },
    );
    expect(res.status).toBe(401);
    expect(applyOneImportLead).not.toHaveBeenCalled();
    expect(createCrmInboundEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        endpointId: "wanted",
        status: "error",
        message: "Token inválido",
      }),
    );
    expect(getCrmInboundEndpointByTokenHash).toHaveBeenCalledWith(
      hashInboundToken("good-token"),
    );
  });

  it("creates a deal when id and token match", async () => {
    getCrmInboundEndpointByTokenHash.mockResolvedValue({
      id: "wanted",
      user_id: "u1",
      pipeline_id: "p1",
      stage_id: "s1",
      lead_kind: "company",
      channel: "site",
    });
    applyOneImportLead.mockResolvedValue({
      deal: { id: "d1" },
      created: true,
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/leads/wanted", {
        method: "POST",
        headers: {
          Authorization: "Bearer good-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "company",
          company: "Roal",
          answers: { volume: "10 t" },
        }),
      }),
      { params: Promise.resolve({ endpointId: "wanted" }) },
    );
    expect(res.status).toBe(201);
    expect(applyOneImportLead).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultKind: "company",
        formChannel: "site",
        row: expect.objectContaining({
          company: "Roal",
          kind: "company",
        }),
      }),
    );
  });
});
