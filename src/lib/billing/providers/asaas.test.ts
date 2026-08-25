import { afterEach, describe, expect, it } from "vitest";
import { asaasProvider } from "@/lib/billing/providers/asaas";
import { asaasAccessToken, webhookSecretsEqual } from "@/lib/billing/webhook-guard";

afterEach(() => {
  delete process.env.ASAAS_WEBHOOK_TOKEN;
  delete process.env.GRID_ENV;
});

function req(headers: Record<string, string> = {}) {
  return new Request("https://grid.mundopodium.com.br/api/billing/webhooks/asaas", {
    method: "POST",
    headers,
  });
}

describe("asaas webhook auth", () => {
  it("reads asaas-access-token", () => {
    expect(asaasAccessToken(req({ "asaas-access-token": " abc " }))).toBe("abc");
  });

  it("accepts Bearer authorization", () => {
    expect(asaasAccessToken(req({ authorization: "Bearer secret" }))).toBe("secret");
  });

  it("compares secrets by hash", () => {
    expect(webhookSecretsEqual("same", "same")).toBe(true);
    expect(webhookSecretsEqual("a", "b")).toBe(false);
  });

  it("acks empty body after auth", async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = "token-32-chars-minimum-aaaaaa";
    const event = await asaasProvider.parseWebhook(
      req({ "asaas-access-token": "token-32-chars-minimum-aaaaaa" }),
      "",
    );
    expect(event).toBeNull();
  });

  it("maps PAYMENT_RECEIVED", async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = "token-32-chars-minimum-aaaaaa";
    const event = await asaasProvider.parseWebhook(
      req({ "asaas-access-token": "token-32-chars-minimum-aaaaaa" }),
      JSON.stringify({
        id: "evt_1",
        event: "PAYMENT_RECEIVED",
        payment: { id: "pay_1" },
      }),
    );
    expect(event?.type).toBe("payment.paid");
    expect(event?.providerPaymentId).toBe("pay_1");
  });

  it("forwards externalReference as orderId", async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = "token-32-chars-minimum-aaaaaa";
    const event = await asaasProvider.parseWebhook(
      req({ "asaas-access-token": "token-32-chars-minimum-aaaaaa" }),
      JSON.stringify({
        id: "evt_2",
        event: "PAYMENT_RECEIVED",
        payment: { id: "pay_2", externalReference: "order-uuid" },
      }),
    );
    expect(event?.orderId).toBe("order-uuid");
  });

  it("rejects wrong token", async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = "token-32-chars-minimum-aaaaaa";
    await expect(
      asaasProvider.parseWebhook(req({ "asaas-access-token": "nope" }), "{}"),
    ).rejects.toThrow(/não autorizado/);
  });
});
