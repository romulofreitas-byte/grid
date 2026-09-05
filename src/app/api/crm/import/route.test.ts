import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const applyImportLeads = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/crm/import-apply", () => ({
  applyImportLeads: (...args: unknown[]) => applyImportLeads(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ tag: "repo" }),
}));

import { POST } from "./route";

describe("POST /api/crm/import", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    applyImportLeads.mockReset();
  });

  it("returns 403 when CRM is locked", async () => {
    const { CrmNotAllowedError } = await import("@/lib/billing/types");
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await POST(
      new Request("http://localhost/api/crm/import", {
        method: "POST",
        body: JSON.stringify({
          pipeline_id: "11111111-1111-4111-8111-111111111111",
          rows: [{ name: "Maria" }],
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(applyImportLeads).not.toHaveBeenCalled();
  });

  it("imports mapped rows", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    applyImportLeads.mockResolvedValue({
      created: 1,
      skipped: 0,
      errors: [],
      deals: [{ id: "d1", created: true }],
    });
    const res = await POST(
      new Request("http://localhost/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: "11111111-1111-4111-8111-111111111111",
          rows: [{ name: "Maria", email: "m@x.com" }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ created: 1, skipped: 0 });
    expect(applyImportLeads).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        source: "import",
      }),
    );
  });
});
