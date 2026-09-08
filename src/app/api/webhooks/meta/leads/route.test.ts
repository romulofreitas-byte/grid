import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCrmMetaConnectionByPageId = vi.hoisted(() => vi.fn());
const findCrmInboundEndpointsForMetaLead = vi.hoisted(() => vi.fn());
const findCrmInboundEventByExternalId = vi.hoisted(() => vi.fn());
const createCrmInboundEvent = vi.hoisted(() => vi.fn());
const applyOneImportLead = vi.hoisted(() => vi.fn());
const getBalance = vi.hoisted(() => vi.fn());
const fetchMetaLead = vi.hoisted(() => vi.fn());
const decryptPageToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/crm/import-apply", () => ({
  applyOneImportLead: (...args: unknown[]) => applyOneImportLead(...args),
}));

vi.mock("@/lib/billing/service", () => ({
  getBalance: (...args: unknown[]) => getBalance(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({
    getCrmMetaConnectionByPageId,
    findCrmInboundEndpointsForMetaLead,
    findCrmInboundEventByExternalId,
    createCrmInboundEvent,
  }),
}));

vi.mock("@/lib/crm/meta-leads", async () => {
  const actual = await vi.importActual<typeof import("@/lib/crm/meta-leads")>(
    "@/lib/crm/meta-leads",
  );
  return {
    ...actual,
    fetchMetaLead: (...args: unknown[]) => fetchMetaLead(...args),
    decryptPageToken: (...args: unknown[]) => decryptPageToken(...args),
  };
});

vi.mock("@/lib/crm/meta-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/crm/meta-api")>(
    "@/lib/crm/meta-api",
  );
  return {
    ...actual,
    metaWebhookVerifyToken: () => "verify-me",
  };
});

import { GET, POST } from "./route";

const ENDPOINT = {
  id: "e1",
  user_id: "u1",
  pipeline_id: "p1",
  stage_id: "s1",
  nome: "Meta",
  lead_kind: "person" as const,
  channel: "meta" as const,
  token_hash: "x",
  public_token_hash: null,
  form_fields: {},
  meta_connection_id: "c1",
  meta_form_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("GET /api/webhooks/meta/leads", () => {
  it("echoes the hub challenge when the verify token matches", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/webhooks/meta/leads?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("abc");
  });

  it("rejects a bad verify token", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/webhooks/meta/leads?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=abc",
      ),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/webhooks/meta/leads", () => {
  beforeEach(() => {
    vi.stubEnv("META_APP_SECRET", "");
    getCrmMetaConnectionByPageId.mockReset();
    findCrmInboundEndpointsForMetaLead.mockReset();
    findCrmInboundEventByExternalId.mockReset();
    createCrmInboundEvent.mockReset();
    applyOneImportLead.mockReset();
    getBalance.mockReset();
    fetchMetaLead.mockReset();
    decryptPageToken.mockReset();
    getBalance.mockResolvedValue({ plano: "piloto_pro", enrichAllowed: true });
    createCrmInboundEvent.mockResolvedValue(null);
    findCrmInboundEventByExternalId.mockResolvedValue(null);
    decryptPageToken.mockReturnValue("page-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ingests a leadgen payload into the CRM", async () => {
    getCrmMetaConnectionByPageId.mockResolvedValue({
      id: "c1",
      credentials_ciphertext: "ct",
      credentials_nonce: "n",
    });
    findCrmInboundEndpointsForMetaLead.mockResolvedValue([ENDPOINT]);
    fetchMetaLead.mockResolvedValue({
      id: "lg-9",
      field_data: [
        { name: "full_name", values: ["Maria"] },
        { name: "phone_number", values: ["1199"] },
      ],
    });
    applyOneImportLead.mockResolvedValue({
      deal: { id: "d1" },
      created: true,
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/meta/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: [
            {
              id: "page-1",
              changes: [
                {
                  field: "leadgen",
                  value: {
                    leadgen_id: "lg-9",
                    form_id: "form-3",
                    page_id: "page-1",
                  },
                },
              ],
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(applyOneImportLead).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        source: "inbound",
        formChannel: "meta",
        row: expect.objectContaining({ name: "Maria" }),
      }),
    );
    expect(createCrmInboundEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        externalId: "lg-9",
        status: "created",
      }),
    );
  });

  it("skips Graph fetch when the leadgen_id already created a deal", async () => {
    getCrmMetaConnectionByPageId.mockResolvedValue({
      id: "c1",
      credentials_ciphertext: "ct",
      credentials_nonce: "n",
    });
    findCrmInboundEndpointsForMetaLead.mockResolvedValue([ENDPOINT]);
    fetchMetaLead.mockResolvedValue({
      id: "lg-9",
      field_data: [{ name: "full_name", values: ["Maria"] }],
    });
    findCrmInboundEventByExternalId.mockResolvedValue({
      deal_id: "d1",
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/meta/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: [
            {
              id: "page-1",
              changes: [
                {
                  field: "leadgen",
                  value: { leadgen_id: "lg-9", page_id: "page-1" },
                },
              ],
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(fetchMetaLead).not.toHaveBeenCalled();
    expect(applyOneImportLead).not.toHaveBeenCalled();
  });

  it("rejects an unsigned payload when the app secret is set", async () => {
    vi.stubEnv("META_APP_SECRET", "app-secret");
    const res = await POST(
      new Request("http://localhost/api/webhooks/meta/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: [] }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
