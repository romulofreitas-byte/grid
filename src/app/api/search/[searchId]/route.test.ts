import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const getSearchForUser = vi.hoisted(() => vi.fn());
const deleteSearch = vi.hoisted(() => vi.fn());
const deleteCrmEntradaDealsForSearch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/auth/search-access", () => ({
  getSearchForUser: (...args: unknown[]) => getSearchForUser(...args),
}));

vi.mock("@/lib/catchup/saved-list", () => ({
  onSearchSaved: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ deleteSearch, deleteCrmEntradaDealsForSearch }),
}));

import { DELETE } from "./route";

const SEARCH = "11111111-1111-4111-8111-111111111111";

describe("DELETE /api/search/[searchId]", () => {
  beforeEach(() => {
    guardApi.mockReset();
    getSearchForUser.mockReset();
    deleteSearch.mockReset();
    deleteCrmEntradaDealsForSearch.mockReset();
  });

  it("deletes the list without touching CRM entrada by default", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    getSearchForUser.mockResolvedValue({ id: SEARCH, saved: true });
    deleteSearch.mockResolvedValue(true);
    const res = await DELETE(
      new Request(`http://localhost/api/search/${SEARCH}`, { method: "DELETE" }),
      { params: Promise.resolve({ searchId: SEARCH }) },
    );
    expect(res.status).toBe(200);
    expect(deleteCrmEntradaDealsForSearch).not.toHaveBeenCalled();
    expect(deleteSearch).toHaveBeenCalledWith(SEARCH);
  });

  it("optionally removes GRID Entrada deals from that list", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    getSearchForUser.mockResolvedValue({ id: SEARCH, saved: true });
    deleteSearch.mockResolvedValue(true);
    deleteCrmEntradaDealsForSearch.mockResolvedValue(3);
    const res = await DELETE(
      new Request(`http://localhost/api/search/${SEARCH}`, {
        method: "DELETE",
        body: JSON.stringify({ removeEntrada: true }),
      }),
      { params: Promise.resolve({ searchId: SEARCH }) },
    );
    expect(res.status).toBe(200);
    expect(deleteCrmEntradaDealsForSearch).toHaveBeenCalledWith("u1", SEARCH);
  });
});
