import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { AutomationsNotAllowedError, CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const assertAutomationsAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
  assertAutomationsAccess: (...args: unknown[]) => assertAutomationsAccess(...args),
}));

import { guardAutomationsApi, guardCrmApi } from "./_http";

describe("guardCrmApi", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    assertAutomationsAccess.mockReset();
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
        "Os 30 dias do Piloto da Plataforma acabaram. Assine o Piloto para continuar.",
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

describe("guardAutomationsApi", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    assertAutomationsAccess.mockReset();
  });

  it("returns 403 when automations are not on the plan", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true, plano: "piloto" });
    assertAutomationsAccess.mockRejectedValue(new AutomationsNotAllowedError());
    const res = await guardAutomationsApi(
      new Request("http://localhost/api/crm/inbound"),
      "read",
    );
    expect(res).toBeInstanceOf(NextResponse);
    const body = await (res as NextResponse).json();
    expect((res as NextResponse).status).toBe(403);
    expect(body.code).toBe("plan_required");
    expect(body.error).toMatch(/Piloto Pro/);
    expect(body.upgradeUrl).toBe("/planos");
  });

  it("passes through when the plan allows automations", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: "a@b.com" });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true, plano: "piloto_pro" });
    assertAutomationsAccess.mockResolvedValue({
      enrichAllowed: true,
      plano: "piloto_pro",
    });
    const gated = await guardAutomationsApi(
      new Request("http://localhost/api/crm/inbound"),
      "read",
    );
    expect(gated).toEqual({ userId: "u1", email: "a@b.com" });
  });
});
