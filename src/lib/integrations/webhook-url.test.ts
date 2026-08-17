import { describe, expect, it } from "vitest";
import { isAllowedWebhookUrl } from "./webhook-url";

describe("isAllowedWebhookUrl", () => {
  it("allows https and localhost http", () => {
    expect(isAllowedWebhookUrl("https://hooks.example.com/grid")).toBe(true);
    expect(isAllowedWebhookUrl("http://localhost:4242/hook")).toBe(true);
  });

  it("rejects cleartext remote and metadata IPs", () => {
    expect(isAllowedWebhookUrl("http://evil.test/hook")).toBe(false);
    expect(isAllowedWebhookUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedWebhookUrl("not-a-url")).toBe(false);
  });
});
