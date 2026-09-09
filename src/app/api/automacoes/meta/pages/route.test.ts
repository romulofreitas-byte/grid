import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const assertAutomationsAccess = vi.hoisted(() => vi.fn());
const listCrmMetaConnections = vi.hoisted(() => vi.fn());
const listCrmMetaPendingConnections = vi.hoisted(() => vi.fn());
const listCrmMetaSelectableRecords = vi.hoisted(() => vi.fn());
const updateCrmMetaConnectionStatus = vi.hoisted(() => vi.fn());
const decryptPageToken = vi.hoisted(() => vi.fn());
const subscribePageToLeadgen = vi.hoisted(() => vi.fn());
const metaConfigured = vi.hoisted(() => vi.fn());

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
    listCrmMetaConnections,
    listCrmMetaPendingConnections,
    listCrmMetaSelectableRecords,
    updateCrmMetaConnectionStatus,
  }),
}));

vi.mock("@/lib/crm/meta-api", () => ({
  metaConfigured: (...args: unknown[]) => metaConfigured(...args),
}));

vi.mock("@/lib/crm/meta-leads", () => ({
  decryptPageToken: (...args: unknown[]) => decryptPageToken(...args),
  subscribePageToLeadgen: (...args: unknown[]) => subscribePageToLeadgen(...args),
}));

import { GET, POST } from "./route";

const pendingA = {
  id: "c1",
  user_id: "u1",
  page_id: "p1",
  page_name: "Clínica",
  status: "pending" as const,
  credentials_ciphertext: "ct-1",
  credentials_nonce: "n-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const pendingB = {
  ...pendingA,
  id: "c2",
  page_id: "p2",
  page_name: "Loja",
  credentials_ciphertext: "ct-2",
  credentials_nonce: "n-2",
};

const activeA = {
  id: pendingA.id,
  user_id: pendingA.user_id,
  page_id: pendingA.page_id,
  page_name: pendingA.page_name,
  status: "active" as const,
  created_at: pendingA.created_at,
  updated_at: pendingA.updated_at,
};

describe("automacoes meta pages API", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    assertAutomationsAccess.mockReset();
    listCrmMetaConnections.mockReset();
    listCrmMetaPendingConnections.mockReset();
    listCrmMetaSelectableRecords.mockReset();
    updateCrmMetaConnectionStatus.mockReset();
    decryptPageToken.mockReset();
    subscribePageToLeadgen.mockReset();
    metaConfigured.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true, plano: "piloto_pro" });
    assertAutomationsAccess.mockResolvedValue({
      enrichAllowed: true,
      plano: "piloto_pro",
    });
    metaConfigured.mockReturnValue(true);
    decryptPageToken.mockReturnValue("page-token");
    subscribePageToLeadgen.mockResolvedValue(undefined);
    updateCrmMetaConnectionStatus.mockImplementation(
      async (_userId: string, pageId: string, status: string) => ({
        ...(pageId === pendingB.page_id ? pendingB : pendingA),
        status,
      }),
    );
  });

  it("lists active pages apart from pending ones", async () => {
    listCrmMetaConnections.mockResolvedValue([activeA]);
    listCrmMetaPendingConnections.mockResolvedValue([pendingB]);
    const res = await GET(new Request("http://localhost/api/automacoes/meta/pages"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      pages: [activeA],
      pending: [pendingB],
      configured: true,
    });
  });

  it("activates the chosen pending page and revokes the rest", async () => {
    listCrmMetaSelectableRecords.mockResolvedValue([pendingA, pendingB]);
    listCrmMetaConnections.mockResolvedValue([activeA]);
    listCrmMetaPendingConnections.mockResolvedValue([]);
    const res = await POST(
      new Request("http://localhost/api/automacoes/meta/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageIds: ["p1"] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(subscribePageToLeadgen).toHaveBeenCalledWith("page-token", "p1");
    expect(subscribePageToLeadgen).not.toHaveBeenCalledWith("page-token", "p2");
    expect(updateCrmMetaConnectionStatus).toHaveBeenCalledWith("u1", "p1", "active");
    expect(updateCrmMetaConnectionStatus).toHaveBeenCalledWith("u1", "p2", "revoked");
    expect(await res.json()).toEqual({
      pages: [activeA],
      pending: [],
      configured: true,
    });
  });

  it("does not subscribe a page that is already active", async () => {
    listCrmMetaSelectableRecords.mockResolvedValue([
      { ...pendingA, status: "active" },
      pendingB,
    ]);
    listCrmMetaConnections.mockResolvedValue([activeA]);
    listCrmMetaPendingConnections.mockResolvedValue([]);
    const res = await POST(
      new Request("http://localhost/api/automacoes/meta/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageIds: ["p1"] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(subscribePageToLeadgen).not.toHaveBeenCalled();
    expect(updateCrmMetaConnectionStatus).toHaveBeenCalledWith("u1", "p1", "active");
    expect(updateCrmMetaConnectionStatus).toHaveBeenCalledWith("u1", "p2", "revoked");
  });

  it("rejects an empty selection", async () => {
    const res = await POST(
      new Request("http://localhost/api/automacoes/meta/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageIds: [] }),
      }),
    );
    expect(res.status).toBe(400);
    expect(listCrmMetaSelectableRecords).not.toHaveBeenCalled();
  });
});
