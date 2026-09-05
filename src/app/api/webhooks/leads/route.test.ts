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

describe("POST /api/webhooks/leads", () => {
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

  it("rejects a missing token", async () => {
    const res = await POST(
      new Request("http://localhost/api/webhooks/leads", {
        method: "POST",
        body: JSON.stringify({ name: "Maria" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects an unknown token", async () => {
    getCrmInboundEndpointByTokenHash.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/webhooks/leads", {
        method: "POST",
        headers: { Authorization: "Bearer bad-token" },
        body: JSON.stringify({ name: "Maria" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(getCrmInboundEndpointByTokenHash).toHaveBeenCalledWith(
      hashInboundToken("bad-token"),
    );
  });

  it("creates a deal from a Make payload", async () => {
    getCrmInboundEndpointByTokenHash.mockResolvedValue({
      id: "e1",
      user_id: "u1",
      pipeline_id: "p1",
      stage_id: "s1",
    });
    applyOneImportLead.mockResolvedValue({
      deal: { id: "d1" },
      created: true,
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/leads", {
        method: "POST",
        headers: {
          Authorization: "Bearer good-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razao_social: "Padaria",
          full_name: "Maria",
          telefone: "11999999999",
        }),
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ deal_id: "d1", created: true });
    expect(createCrmInboundEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        status: "created",
        httpStatus: 201,
      }),
    );
    expect(applyOneImportLead).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        pipelineId: "p1",
        stageId: "s1",
        source: "inbound",
        row: expect.objectContaining({
          company: "Padaria",
          name: "Maria",
        }),
      }),
    );
  });

  it("returns 200 when the lead already exists", async () => {
    getCrmInboundEndpointByTokenHash.mockResolvedValue({
      id: "e1",
      user_id: "u1",
      pipeline_id: "p1",
      stage_id: null,
    });
    applyOneImportLead.mockResolvedValue({
      deal: { id: "d1" },
      created: false,
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/leads", {
        method: "POST",
        headers: { Authorization: "Bearer good-token" },
        body: JSON.stringify({ email: "maria@x.com" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deal_id: "d1", created: false });
    expect(createCrmInboundEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ status: "skipped", httpStatus: 200 }),
    );
  });

  it("returns 400 on an empty payload", async () => {
    getCrmInboundEndpointByTokenHash.mockResolvedValue({
      id: "e1",
      user_id: "u1",
      pipeline_id: "p1",
      stage_id: null,
    });
    applyOneImportLead.mockResolvedValue({
      error: "Linha vazia",
      status: 400,
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/leads", {
        method: "POST",
        headers: { Authorization: "Bearer good-token" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a Piloto token even when it is valid", async () => {
    getCrmInboundEndpointByTokenHash.mockResolvedValue({
      id: "e1",
      user_id: "u1",
      pipeline_id: "p1",
      stage_id: null,
    });
    getBalance.mockResolvedValue({ plano: "piloto", enrichAllowed: true });
    const res = await POST(
      new Request("http://localhost/api/webhooks/leads", {
        method: "POST",
        headers: {
          Authorization: "Bearer good-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Maria" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(applyOneImportLead).not.toHaveBeenCalled();
    expect(createCrmInboundEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        status: "error",
        httpStatus: 403,
      }),
    );
  });
});
