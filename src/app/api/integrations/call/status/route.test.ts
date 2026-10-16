import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const getIntegrationConnection = vi.hoisted(() => vi.fn());
const hasInboundCallOutcome = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ getIntegrationConnection, hasInboundCallOutcome }),
}));

import { GET } from "./route";

const CONNECTION_ID = "11111111-1111-4111-8111-111111111111";

function request(query: string) {
  return new Request(`http://localhost/api/integrations/call/status${query}`);
}

describe("GET /api/integrations/call/status", () => {
  beforeEach(() => {
    guardApi.mockReset();
    getIntegrationConnection.mockReset();
    hasInboundCallOutcome.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
  });

  it("returns 400 when the query is incomplete", async () => {
    const res = await GET(request(""));
    expect(res.status).toBe(400);
    expect(getIntegrationConnection).not.toHaveBeenCalled();
  });

  it("returns 404 when the connection belongs to someone else", async () => {
    getIntegrationConnection.mockResolvedValue({
      id: CONNECTION_ID,
      user_id: "other",
    });
    const res = await GET(
      request(`?connectionId=${CONNECTION_ID}&externalId=call-1`),
    );
    expect(res.status).toBe(404);
    expect(hasInboundCallOutcome).not.toHaveBeenCalled();
  });

  it("reports the call ended only after the inbound hangup", async () => {
    getIntegrationConnection.mockResolvedValue({
      id: CONNECTION_ID,
      user_id: "u1",
    });
    hasInboundCallOutcome.mockResolvedValue(true);
    const res = await GET(
      request(`?connectionId=${CONNECTION_ID}&externalId=call-1`),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ended: true });
    expect(hasInboundCallOutcome).toHaveBeenCalledWith("u1", CONNECTION_ID, "call-1");
  });
});
