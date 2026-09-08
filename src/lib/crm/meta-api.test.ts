import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  META_GRAPH_VERSION,
  META_LEADGEN_WEBHOOK_PATH,
  META_OAUTH_CALLBACK_PATH,
  META_OAUTH_RETURN_PATH,
  META_OAUTH_SCOPES,
  metaConfigured,
  metaLeadgenWebhookUrl,
  metaOAuthRedirectUri,
  metaOAuthUrl,
  metaWebhookConfigured,
  verifyMetaWebhookSignature,
} from "./meta-api";

describe("meta API structure", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes the Graph version, OAuth scopes and dashboard paths", () => {
    expect(META_GRAPH_VERSION).toBe("v21.0");
    expect(META_OAUTH_SCOPES).toContain("leads_retrieval");
    expect(META_OAUTH_CALLBACK_PATH).toBe("/api/automacoes/meta/callback");
    expect(META_OAUTH_RETURN_PATH).toBe("/integracoes");
    expect(META_LEADGEN_WEBHOOK_PATH).toBe("/api/webhooks/meta/leads");
    expect(metaOAuthRedirectUri("https://grid.example")).toBe(
      "https://grid.example/api/automacoes/meta/callback",
    );
    expect(metaLeadgenWebhookUrl("https://grid.example/")).toBe(
      "https://grid.example/api/webhooks/meta/leads",
    );
  });

  it("treats OAuth as configured only with app id and secret", () => {
    vi.stubEnv("META_APP_ID", "123");
    vi.stubEnv("META_APP_SECRET", "secret");
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "");
    expect(metaConfigured()).toBe(true);
    expect(metaWebhookConfigured()).toBe(false);
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "verify-me");
    expect(metaWebhookConfigured()).toBe(true);
  });

  it("builds the Facebook OAuth dialog with the app id and scopes", () => {
    vi.stubEnv("META_APP_ID", "app-9");
    const url = new URL(
      metaOAuthUrl("https://grid.example/api/automacoes/meta/callback", "state-1"),
    );
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/v21.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("app-9");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("scope")).toContain("leads_retrieval");
  });

  it("verifies X-Hub-Signature-256 against the app secret", () => {
    vi.stubEnv("META_APP_SECRET", "app-secret");
    const raw = '{"object":"page"}';
    const hex = createHmac("sha256", "app-secret").update(raw, "utf8").digest("hex");
    expect(verifyMetaWebhookSignature(raw, `sha256=${hex}`)).toBe(true);
    expect(verifyMetaWebhookSignature(raw, `sha256=${"ab".repeat(32)}`)).toBe(false);
    expect(verifyMetaWebhookSignature(raw, null)).toBe(false);
  });
});
