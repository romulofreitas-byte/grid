import { beforeEach, describe, expect, it, vi } from "vitest";

const getCrmInboundEndpointByPublicTokenHash = vi.hoisted(() => vi.fn());
const createCrmInboundEvent = vi.hoisted(() => vi.fn());
const applyOneImportLead = vi.hoisted(() => vi.fn());
const getBalance = vi.hoisted(() => vi.fn());

vi.mock("@/lib/crm/import-apply", () => ({
  applyOneImportLead: (...args: unknown[]) => applyOneImportLead(...args),
}));

vi.mock("@/lib/billing/service", () => ({
  getBalance: (...args: unknown[]) => getBalance(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({
    getCrmInboundEndpointByPublicTokenHash,
    createCrmInboundEvent,
  }),
}));

import { hashInboundToken } from "@/lib/crm/inbound-token";
import { POST } from "./route";

const ENDPOINT = {
  id: "e1",
  user_id: "u1",
  pipeline_id: "p1",
  stage_id: "s1",
  nome: "Site",
  lead_kind: "company" as const,
  channel: "site" as const,
  token_hash: "x",
  public_token_hash: "y",
  form_fields: { company: true },
  meta_connection_id: null,
  meta_form_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("POST /api/forms/:token", () => {
  beforeEach(() => {
    getCrmInboundEndpointByPublicTokenHash.mockReset();
    createCrmInboundEvent.mockReset();
    applyOneImportLead.mockReset();
    getBalance.mockReset();
    getBalance.mockResolvedValue({ plano: "piloto_pro", enrichAllowed: true });
    createCrmInboundEvent.mockResolvedValue(null);
  });

  it("rejects an unknown public token", async () => {
    getCrmInboundEndpointByPublicTokenHash.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/forms/tok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Maria", phone: "1199" }),
      }),
      { params: Promise.resolve({ token: "tok" }) },
    );
    expect(res.status).toBe(404);
    expect(getCrmInboundEndpointByPublicTokenHash).toHaveBeenCalledWith(
      hashInboundToken("tok"),
    );
    expect(applyOneImportLead).not.toHaveBeenCalled();
  });

  it("swallows honeypot submissions", async () => {
    getCrmInboundEndpointByPublicTokenHash.mockResolvedValue(ENDPOINT);
    const res = await POST(
      new Request("http://localhost/api/forms/tok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bot",
          phone: "1199",
          empresa_website: "https://spam.test",
        }),
      }),
      { params: Promise.resolve({ token: "tok" }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(applyOneImportLead).not.toHaveBeenCalled();
  });

  it("creates a deal from the public form", async () => {
    getCrmInboundEndpointByPublicTokenHash.mockResolvedValue(ENDPOINT);
    applyOneImportLead.mockResolvedValue({
      deal: { id: "d1" },
      created: true,
    });
    const res = await POST(
      new Request("http://localhost/api/forms/tok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Maria",
          phone: "11999999999",
          email: "maria@x.com",
          company: "Padaria",
        }),
      }),
      { params: Promise.resolve({ token: "tok" }) },
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ deal_id: "d1", created: true });
    expect(applyOneImportLead).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        pipelineId: "p1",
        stageId: "s1",
        source: "inbound",
        formChannel: "site",
        row: expect.objectContaining({
          name: "Maria",
          company: "Padaria",
        }),
      }),
    );
  });
});
