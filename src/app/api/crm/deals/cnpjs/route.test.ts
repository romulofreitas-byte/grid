import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { CrmNotAllowedError } from "@/lib/billing/types";

const guardApi = vi.hoisted(() => vi.fn());
const assertCrmAccess = vi.hoisted(() => vi.fn());
const listCrmDealCnpjs = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  assertCrmAccess: (...args: unknown[]) => assertCrmAccess(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ listCrmDealCnpjs }),
}));

import { GET } from "./route";

describe("GET /api/crm/deals/cnpjs", () => {
  beforeEach(() => {
    guardApi.mockReset();
    assertCrmAccess.mockReset();
    listCrmDealCnpjs.mockReset();
  });

  it("returns 403 when CRM is not on the plan", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockRejectedValue(new CrmNotAllowedError());
    const res = await GET(
      new Request(
        "http://localhost/api/crm/deals/cnpjs?cnpjs=12345678000190",
      ),
    );
    expect(res.status).toBe(403);
    expect(listCrmDealCnpjs).not.toHaveBeenCalled();
  });

  it("returns CNPJs already in the user's CRM", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    listCrmDealCnpjs.mockResolvedValue(["12345678000190"]);
    const res = await GET(
      new Request(
        "http://localhost/api/crm/deals/cnpjs?cnpjs=12.345.678/0001-90,00000000000191",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cnpjs: ["12345678000190"] });
    expect(listCrmDealCnpjs).toHaveBeenCalledWith("u1", [
      "12345678000190",
      "00000000000191",
    ]);
  });

  it("skips the repo when there are no CNPJs", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    assertCrmAccess.mockResolvedValue({ enrichAllowed: true });
    const res = await GET(
      new Request("http://localhost/api/crm/deals/cnpjs"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cnpjs: [] });
    expect(listCrmDealCnpjs).not.toHaveBeenCalled();
  });
});
