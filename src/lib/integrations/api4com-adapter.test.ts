import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createApi4comAdapter,
  parseApi4comInbound,
  probeApi4com,
  registerApi4comWebhook,
} from "./api4com-adapter";
import type { ConnectionCtx } from "./adapter";

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

  it("surfaces a refused token", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 401 }));
    const probed = await probeApi4com("bad");
    expect(probed.ok).toBe(false);
    if (!probed.ok) expect(probed.error).toMatch(/Token recusado/);
  });

  it("registers the inbound webhook on the vendor", async () => {
    let body = "";
    vi.stubGlobal(
      "fetch",
      async (_url: string, init?: RequestInit) => {
        body = String(init?.body ?? "");
        return new Response("{}", { status: 200 });
      },
    );
    await expect(
      registerApi4comWebhook("tok", "https://grid.example/api/webhooks/voip/api4com/x"),
    ).resolves.toBe(true);
    expect(body).toContain("webhookUrl");
    expect(body).toContain("channel-hangup");
  });
});

describe("parseApi4comInbound", () => {
  it("reads hangup cause, duration and CNPJ from metadata", () => {
    const parsed = parseApi4comInbound(
      JSON.stringify({
        event: "channel-hangup",
        hangup_cause: "NORMAL_CLEARING",
        duration: 42,
        to: "11988887777",
        metadata: { cnpj: "12.345.678/0001-90", gateway: "grid-podium" },
      }),
    );
    expect(parsed?.cnpj).toBe("12345678000190");
    expect(parsed?.disposition).toBe("NORMAL_CLEARING");
    expect(parsed?.durationSec).toBe(42);
    expect(parsed?.e164).toBe("+5511988887777");
  });
});
