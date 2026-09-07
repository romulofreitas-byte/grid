import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const loadPreview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/crm/pipeline-removal", () => ({
  loadPipelineRemovalPreview: (...args: unknown[]) => loadPreview(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({}),
}));

import { GET } from "./route";

describe("GET /api/crm/pipelines/[pipelineId]/removal", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    loadPreview.mockReset();
  });

  it("returns the removal preview", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    loadPreview.mockResolvedValue({
      canDeleteDirectly: false,
      advancedCount: 1,
    });
    const res = await GET(
      new Request("http://localhost/api/crm/pipelines/p1/removal"),
      { params: Promise.resolve({ pipelineId: "p1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview.canDeleteDirectly).toBe(false);
  });
});
