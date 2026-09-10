import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createApi4comAdapter,
  parseApi4comInbound,
  probeApi4com,
  registerApi4comWebhook,
} from "./api4com-adapter";
import type { ConnectionCtx } from "./adapter";

const OFFICIAL_HANGUP = {
  version: "v1.4",
  eventType: "channel-hangup",
  id: "2ee13fa4-975c-499d-bbb8-5177ff418316",
  domain: "seudominio.api4com.com",
  direction: "outbound",
  caller: "1000",
  called: "04833328530",
  startedAt: "2025-01-01 00:00:00",
  answeredAt: "2025-01-01 00:00:05",
  endedAt: "2025-01-01 00:00:10",
  duration: 5,
  hangupCause: "NORMAL_CLEARING",
  hangupCauseCode: "16",
  recordUrl:
    "https://listener.api4com.com/files/listen/2ee13fa4-975c-499d-bbb8-5177ff418316.mp3",
  metadata: {
    gateway: "grid-podium",
    cnpj: "12.345.678/0001-90",
  },
};

function ctx(): ConnectionCtx {
  return {
    connectionId: "22222222-2222-4222-8222-222222222222",
    userId: "00000000-0000-4000-8000-000000000001",
    provider: "api4com",
    kind: "voip",
    config: { catalog_id: "api4com" },
    callerId: "1001",
    decryptCredentials: async () => ({ token: "tok-live" }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createApi4comAdapter", () => {
  it("POSTs dialer with ramal, E.164 and GRID metadata", async () => {
    const captured: { url: string; body: string; auth: string | null } = {
      url: "",
      body: "",
      auth: null,
    };
    vi.stubGlobal(
      "fetch",
      async (url: string, init?: RequestInit) => {
        captured.url = String(url);
        captured.body = String(init?.body ?? "");
        captured.auth = new Headers(init?.headers).get("authorization");
        return new Response(JSON.stringify({ id: "call-1", message: "successfull" }), {
          status: 200,
        });
      },
    );
    const result = await createApi4comAdapter().originate!(
      {
        toE164: "+5511988887777",
        from: "1001",
        cnpj: "12345678000190",
        searchId: "11111111-1111-4111-8111-111111111111",
      },
      ctx(),
    );
    expect(result.accepted).toBe(true);
    expect(result.externalId).toBe("call-1");
    expect(captured.url).toContain("/dialer");
    expect(captured.auth).toBe("tok-live");
    const json = JSON.parse(captured.body) as {
      extension: string;
      phone: string;
      metadata: { gateway: string; cnpj: string };
    };
    expect(json.extension).toBe("1001");
    expect(json.phone).toBe("+5511988887777");
    expect(json.metadata.gateway).toBe("grid-podium");
    expect(json.metadata.cnpj).toBe("12345678000190");
  });

  it("normalizes a national BR number to +55 E.164", async () => {
    let body = "";
    vi.stubGlobal(
      "fetch",
      async (_url: string, init?: RequestInit) => {
        body = String(init?.body ?? "");
        return new Response(JSON.stringify({ id: "call-2" }), { status: 200 });
      },
    );
    await createApi4comAdapter().originate!(
      {
        toE164: "3134113893",
        from: "10000",
        cnpj: "12345678000190",
        searchId: null,
      },
      ctx(),
    );
    expect(JSON.parse(body).phone).toBe("+553134113893");
  });

  it("refuses a ramal as the destination", async () => {
    await expect(
      createApi4comAdapter().originate!(
        {
          toE164: "10000",
          from: "10000",
          cnpj: "12345678000190",
          searchId: null,
        },
        ctx(),
      ),
    ).rejects.toThrow(/DDD/);
  });

  it("hangs up with the dialer id and treats 404 as already ended", async () => {
    const captured: { url: string; method: string } = { url: "", method: "" };
    vi.stubGlobal(
      "fetch",
      async (url: string, init?: RequestInit) => {
        captured.url = String(url);
        captured.method = String(init?.method ?? "GET");
        return new Response("{}", { status: 404 });
      },
    );
    await expect(
      createApi4comAdapter().hangup!("1PkXhmBsYAvr9legLB2d7BimT0Q", ctx()),
    ).resolves.toBeUndefined();
    expect(captured.method).toBe("POST");
    expect(captured.url).toContain("/calls/1PkXhmBsYAvr9legLB2d7BimT0Q/hangup");
  });

  it("surfaces a refused token", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 401 }));
    const probed = await probeApi4com("bad");
    expect(probed.ok).toBe(false);
    if (!probed.ok) expect(probed.error).toMatch(/Token recusado/);
  });

  it("registers the inbound webhook with both constraint shapes", async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      async (_url: string, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ""));
        return new Response("{}", { status: 200 });
      },
    );
    await expect(
      registerApi4comWebhook("tok", "https://grid.example/api/webhooks/voip/api4com/x"),
    ).resolves.toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain("webhookUrl");
    expect(bodies[0]).toContain("channel-hangup");
    expect(bodies[0]).toContain("\"webhookVersion\":\"1.8\"");
    expect(bodies[0]).toContain("\"gateway\":\"grid-podium\"");
    expect(bodies[0]).toContain("\"metadata\":{\"gateway\":\"grid-podium\"}");
  });

  it("falls back to the OpenAPI constraint when the dual payload is refused", async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      async (_url: string, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ""));
        return new Response("bad constraint", {
          status: bodies.length === 1 ? 400 : 200,
        });
      },
    );
    await expect(
      registerApi4comWebhook("tok", "https://grid.example/api/webhooks/voip/api4com/x"),
    ).resolves.toBe(true);
    expect(bodies).toHaveLength(2);
    const fallback = JSON.parse(bodies[1]!) as {
      webhookConstraint: { gateway: string; metadata?: unknown };
    };
    expect(fallback.webhookConstraint.gateway).toBe("grid-podium");
    expect(fallback.webhookConstraint.metadata).toBeUndefined();
  });
});

describe("parseApi4comInbound", () => {
  it("reads the official hangup payload", () => {
    const parsed = parseApi4comInbound(JSON.stringify(OFFICIAL_HANGUP));
    expect(parsed?.cnpj).toBe("12345678000190");
    expect(parsed?.disposition).toBe("NORMAL_CLEARING");
    expect(parsed?.notes).toBe("Atendida");
    expect(parsed?.durationSec).toBe(5);
    expect(parsed?.e164).toBe("+554833328530");
    expect(parsed?.externalId).toBe("2ee13fa4-975c-499d-bbb8-5177ff418316");
    expect(parsed?.recordingUrl).toContain("2ee13fa4-975c-499d-bbb8-5177ff418316.mp3");
    expect(parsed?.dealId).toBeUndefined();
  });

  it("reads deal_id from hangup metadata", () => {
    const parsed = parseApi4comInbound(
      JSON.stringify({
        ...OFFICIAL_HANGUP,
        metadata: {
          ...OFFICIAL_HANGUP.metadata,
          deal_id: "22222222-2222-4222-8222-222222222222",
        },
      }),
    );
    expect(parsed?.dealId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("ignores channel-answer", () => {
    expect(
      parseApi4comInbound(
        JSON.stringify({
          ...OFFICIAL_HANGUP,
          eventType: "channel-answer",
          hangupCause: undefined,
          recordUrl: undefined,
          endedAt: undefined,
        }),
      ),
    ).toBeNull();
  });

  it("still reads the legacy snake_case hangup shape", () => {
    const parsed = parseApi4comInbound(
      JSON.stringify({
        event: "channel-hangup",
        hangup_cause: "USER_BUSY",
        duration: 42,
        to: "11988887777",
        metadata: { cnpj: "12.345.678/0001-90", gateway: "grid-podium" },
      }),
    );
    expect(parsed?.cnpj).toBe("12345678000190");
    expect(parsed?.disposition).toBe("USER_BUSY");
    expect(parsed?.notes).toBe("Ocupado");
    expect(parsed?.durationSec).toBe(42);
    expect(parsed?.e164).toBe("+5511988887777");
  });
});
