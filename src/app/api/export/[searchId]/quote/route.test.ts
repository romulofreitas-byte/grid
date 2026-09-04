import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const getSearchForUser = vi.hoisted(() => vi.fn());
const qualifiedLeadsForExport = vi.hoisted(() => vi.fn());
const quoteExport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/auth/search-access", () => ({
  getSearchForUser: (...args: unknown[]) => getSearchForUser(...args),
}));

vi.mock("@/lib/export/qualified", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/export/qualified")>();
  return {
    ...actual,
    qualifiedLeadsForExport: (...args: unknown[]) =>
      qualifiedLeadsForExport(...args),
  };
});

vi.mock("@/lib/billing/service", () => ({
  quoteExport: (...args: unknown[]) => quoteExport(...args),
}));

import { GET } from "./route";
import { EXPORT_NEEDS_QUALIFY } from "@/lib/export/qualified";

const searchId = "11111111-1111-1111-1111-111111111111";

function request(format?: string) {
  const url = format
    ? `http://localhost/api/export/${searchId}/quote?format=${format}`
    : `http://localhost/api/export/${searchId}/quote`;
  return new Request(url);
}

describe("GET /api/export/[searchId]/quote", () => {
  beforeEach(() => {
    guardApi.mockReset();
    getSearchForUser.mockReset();
    qualifiedLeadsForExport.mockReset();
    quoteExport.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    getSearchForUser.mockResolvedValue({ id: searchId, user_id: "u1" });
  });

  it("returns 404 when the search is missing", async () => {
    getSearchForUser.mockResolvedValue(null);
    const res = await GET(request("xlsx"), {
      params: Promise.resolve({ searchId }),
    });
    expect(res.status).toBe(404);
    expect(quoteExport).not.toHaveBeenCalled();
  });

  it("returns 400 when nothing is qualified", async () => {
    qualifiedLeadsForExport.mockResolvedValue([]);
    const res = await GET(request("xlsx"), {
      params: Promise.resolve({ searchId }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: EXPORT_NEEDS_QUALIFY });
    expect(quoteExport).not.toHaveBeenCalled();
  });

  it("quotes with the PDF cap", async () => {
    qualifiedLeadsForExport.mockResolvedValue([
      { establishment: { cnpj: "12345678000190" } },
    ]);
    quoteExport.mockResolvedValue({
      companies: 1,
      chargeable: 1,
      skipped: 0,
      unitCost: 50,
      needed: 50,
      available: 900,
    });
    const res = await GET(request("pdf"), {
      params: Promise.resolve({ searchId }),
    });
    expect(res.status).toBe(200);
    expect(qualifiedLeadsForExport).toHaveBeenCalledWith("u1", searchId, 50);
    expect(quoteExport).toHaveBeenCalledWith("u1", ["12345678000190"]);
    expect(await res.json()).toMatchObject({ needed: 50, available: 900 });
  });

  it("quotes the list cap when format is omitted", async () => {
    qualifiedLeadsForExport.mockResolvedValue([
      { establishment: { cnpj: "12345678000190" } },
    ]);
    quoteExport.mockResolvedValue({
      companies: 1,
      chargeable: 0,
      skipped: 1,
      unitCost: 50,
      needed: 0,
      available: 850,
    });
    const res = await GET(request(), {
      params: Promise.resolve({ searchId }),
    });
    expect(res.status).toBe(200);
    expect(qualifiedLeadsForExport).toHaveBeenCalledWith("u1", searchId, 1000);
    expect(await res.json()).toMatchObject({ needed: 0, skipped: 1 });
  });
});
