import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

import { guardCrmApi } from "./_http";

describe("guardCrmApi", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
  });

  it("returns 403 when CRM is not on the plan", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await guardCrmApi(new Request("http://localhost/api/crm/pipelines"), "read");
    expect(res).toBeInstanceOf(NextResponse);
    const body = await (res as NextResponse).json();
    expect((res as NextResponse).status).toBe(403);
    expect(body.code).toBe("plan_required");
    expect(body.upgradeUrl).toBe("/planos");
  });

  it("returns trial_expired when the platform trial ended", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(
      new CrmNotAllowedError(
        "Os 30 dias do Piloto da Plataforma acabaram. Recarregue ou assine o Piloto.",
      ),
    );
    const res = await guardCrmApi(new Request("http://localhost/api/crm/pipelines"), "read");
    expect(res).toBeInstanceOf(NextResponse);
    const body = await (res as NextResponse).json();
    expect((res as NextResponse).status).toBe(403);
    expect(body.code).toBe("trial_expired");
  });

  it("passes through when the plan allows CRM", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: "a@b.com" });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    const gated = await guardCrmApi(
      new Request("http://localhost/api/crm/pipelines"),
      "read",
    );
    expect(gated).toEqual({ userId: "u1", email: "a@b.com" });
  });
});
