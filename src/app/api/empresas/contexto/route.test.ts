import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const filterQualifiedCnpjs = vi.hoisted(() => vi.fn());
const listCompanyGridContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/billing/service", () => ({
  filterQualifiedCnpjs: (...args: unknown[]) => filterQualifiedCnpjs(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ listCompanyGridContext }),
}));

import { GET } from "./route";

describe("GET /api/empresas/contexto", () => {
  beforeEach(() => {
    guardApi.mockReset();
    filterQualifiedCnpjs.mockReset();
    listCompanyGridContext.mockReset();
  });

  it("returns empty when there are no CNPJs", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    const res = await GET(
      new Request("http://localhost/api/empresas/contexto"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
    expect(listCompanyGridContext).not.toHaveBeenCalled();
  });

  it("merges Grid placement with qualification", async () => {
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    listCompanyGridContext.mockResolvedValue([
      {
        cnpj: "12345678000190",
        called: true,
        list: { searchId: "s1", nome: "Clínicas", saved: true },
        crm: {
          dealId: "d1",
          pipelineId: "p1",
          pipelineNome: "Clínicas",
          stageNome: "Entrada",
          nextKind: "ligar",
          nextDueAt: "2026-09-09T12:00:00.000Z",
        },
      },
    ]);
    filterQualifiedCnpjs.mockResolvedValue(["12345678000190"]);
    const res = await GET(
      new Request(
        "http://localhost/api/empresas/contexto?cnpjs=12.345.678/0001-90",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        {
          cnpj: "12345678000190",
          called: true,
          qualified: true,
          list: { searchId: "s1", nome: "Clínicas", saved: true },
          crm: {
            dealId: "d1",
            pipelineId: "p1",
            pipelineNome: "Clínicas",
            stageNome: "Entrada",
            nextKind: "ligar",
            nextDueAt: "2026-09-09T12:00:00.000Z",
          },
        },
      ],
    });
  });
});
