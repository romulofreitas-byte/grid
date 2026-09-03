import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const getSearchForUser = vi.hoisted(() => vi.fn());
const runCrmQualifyBridge = vi.hoisted(() => vi.fn());
const runUserCatchUp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/auth/search-access", () => ({
  getSearchForUser: (...args: unknown[]) => getSearchForUser(...args),
}));

vi.mock("@/lib/catchup/run", () => ({
  runUserCatchUp: (...args: unknown[]) => runUserCatchUp(...args),
}));

vi.mock("@/lib/catchup/tasks/crm-qualify-bridge", () => ({
  runCrmQualifyBridge: (...args: unknown[]) => runCrmQualifyBridge(...args),
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ tag: "repo" }),
}));

import { POST } from "./route";

function post(body?: unknown) {
  return POST(
    new Request("http://localhost/api/session/catch-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

describe("POST /api/session/catch-up", () => {
  beforeEach(() => {
    guardApi.mockReset();
    getSearchForUser.mockReset();
    runCrmQualifyBridge.mockReset();
    runUserCatchUp.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
  });

  it("scopes the qualify bridge to searchId without requiring cnpjs", async () => {
    getSearchForUser.mockResolvedValue({ id: "save-later", saved: true });
    runCrmQualifyBridge.mockResolvedValue({
      created: 2,
      skipped: 0,
      hasMore: false,
      pipelineId: "pipe-1",
    });

    const res = await post({ searchId: "save-later" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      created: 2,
      pipelineId: "pipe-1",
    });
    expect(runCrmQualifyBridge).toHaveBeenCalledWith(
      { tag: "repo" },
      "u1",
      { searchId: "save-later" },
    );
    expect(runUserCatchUp).not.toHaveBeenCalled();
  });

  it("passes cnpjs when the client already knows the targets", async () => {
    getSearchForUser.mockResolvedValue({ id: "saved", saved: true });
    runCrmQualifyBridge.mockResolvedValue({
      created: 1,
      skipped: 0,
      hasMore: false,
    });

    const res = await post({ searchId: "saved", cnpjs: ["123"] });
    expect(res.status).toBe(200);
    expect(runCrmQualifyBridge).toHaveBeenCalledWith(
      { tag: "repo" },
      "u1",
      { searchId: "saved", cnpjs: ["123"] },
    );
    expect(runUserCatchUp).not.toHaveBeenCalled();
  });

  it("runs the full account catch-up when searchId is omitted", async () => {
    runUserCatchUp.mockResolvedValue({ created: 0, skipped: 0, hasMore: false });
    const res = await post({});
    expect(res.status).toBe(200);
    expect(runCrmQualifyBridge).not.toHaveBeenCalled();
    expect(runUserCatchUp).toHaveBeenCalledWith("u1", { tag: "repo" });
  });

  it("returns 404 when the search is not owned", async () => {
    getSearchForUser.mockResolvedValue(null);
    const res = await post({ searchId: "missing" });
    expect(res.status).toBe(404);
    expect(runCrmQualifyBridge).not.toHaveBeenCalled();
    expect(runUserCatchUp).not.toHaveBeenCalled();
  });
});
