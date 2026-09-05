import { describe, expect, it } from "vitest";
import {
  generateInboundToken,
  hashInboundToken,
  inboundLeadsUrl,
  inboundTokensEqual,
  parseBearerToken,
  publicRequestOrigin,
} from "./inbound-token";

describe("inbound token", () => {
  it("hashes and compares tokens", () => {
    const token = generateInboundToken();
    const hash = hashInboundToken(token);
    expect(hash).toHaveLength(64);
    expect(inboundTokensEqual(hash, hashInboundToken(token))).toBe(true);
    expect(inboundTokensEqual(hash, hashInboundToken(`${token}x`))).toBe(false);
  });

  it("parses a Bearer header", () => {
    expect(parseBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(parseBearerToken("bearer abc")).toBe("abc");
    expect(parseBearerToken("Token abc")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  it("builds the public origin and leads URL", () => {
    const req = new Request("http://localhost:3000/api/crm/inbound", {
      headers: {
        "x-forwarded-host": "grid.example",
        "x-forwarded-proto": "https",
      },
    });
    expect(publicRequestOrigin(req)).toBe("https://grid.example");
    expect(inboundLeadsUrl("https://grid.example")).toBe(
      "https://grid.example/api/webhooks/leads",
    );
  });
});
