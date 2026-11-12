import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const guardApi = vi.hoisted(() => vi.fn());
const getIntegrationConnection = vi.hoisted(() => vi.fn());
const hasInboundCallOutcome = vi.hoisted(() => vi.fn());
const lookupApi4comCallEnded = vi.hoisted(() => vi.fn());
const decryptJson = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/api-guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  isGuardReject: (value: unknown) => value instanceof NextResponse,
}));

vi.mock("@/lib/data", () => ({
  getRepo: () => ({ getIntegrationConnection, hasInboundCallOutcome }),
}));

vi.mock("@/lib/integrations/crypto", () => ({
  decryptJson: (...args: unknown[]) => decryptJson(...args),
}));

vi.mock("@/lib/integrations/api4com-recording", () => ({
  lookupApi4comCallEnded: (...args: unknown[]) => lookupApi4comCallEnded(...args),
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
    lookupApi4comCallEnded.mockReset();
    decryptJson.mockReset();
    guardApi.mockResolvedValue({ userId: "u1", email: null });
    decryptJson.mockResolvedValue({ token: "tok" });
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
    expect(hasInboundCallOutcome).toHaveBeenCalledWith(
      "u1",
      CONNECTION_ID,
      "call-1",
      null,
    );
    expect(lookupApi4comCallEnded).not.toHaveBeenCalled();
  });

  it("treats an API4COM webphone hangup as ended when the dial id differs", async () => {
    getIntegrationConnection.mockResolvedValue({
      id: CONNECTION_ID,
      user_id: "u1",
      provider: "api4com",
      credentials_ciphertext: "cipher",
      credentials_nonce: "nonce",
    });
    hasInboundCallOutcome.mockResolvedValue(false);
    lookupApi4comCallEnded.mockResolvedValue(true);
    const res = await GET(
      request(
        `?connectionId=${CONNECTION_ID}&externalId=dialer-1&callRef=ref-1`,
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ended: true });
    expect(hasInboundCallOutcome).toHaveBeenCalledWith(
      "u1",
      CONNECTION_ID,
      "dialer-1",
      "ref-1",
    );
    expect(lookupApi4comCallEnded).toHaveBeenCalledWith("tok", {
      vendorId: "dialer-1",
      callRef: "ref-1",
    });
  });
});
