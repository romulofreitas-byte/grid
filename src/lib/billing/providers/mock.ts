import type { PaymentMethod } from "@/lib/billing/catalog";
import type { BillingOrder } from "@/lib/billing/types";
import type {
  ChargeResult,
  PaymentProvider,
  ProviderCustomer,
} from "@/lib/billing/providers/types";

function fakePixPayload(orderId: string): string {
  return `00020126580014br.gov.bcb.pix0136grid-mock-${orderId}5204000053039865802BR5925GRID MUNDO PODIUM6009SAO PAULO62070503***6304ABCD`;
}

export const mockProvider: PaymentProvider = {
  id: "mock",

  async createCustomer() {
    return `cus_mock_${crypto.randomUUID()}`;
  },

  async createCharge(order: BillingOrder, _customerId: string, method: PaymentMethod) {
    return chargeShape(order, method);
  },

  async createSubscription(order, _customerId, method) {
    return {
      ...chargeShape(order, method),
      providerSubId: `sub_mock_${order.id}`,
    };
  },

  async cancelSubscription() {
    /* no-op */
  },

  async parseWebhook() {
    return null;
  },
};

function chargeShape(order: BillingOrder, method: PaymentMethod): ChargeResult {
  const providerPaymentId = `pay_mock_${order.id}`;
  if (method === "pix") {
    return {
      providerPaymentId,
      pixCopy: fakePixPayload(order.id),
      pixQr: `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#fff"/><rect x="10" y="10" width="40" height="40" fill="#0b1a2e"/><rect x="70" y="10" width="40" height="40" fill="#0b1a2e"/><rect x="10" y="70" width="40" height="40" fill="#0b1a2e"/><rect x="55" y="55" width="20" height="20" fill="#f5b301"/></svg>`,
      )}`,
    };
  }
  if (method === "boleto") {
    return {
      providerPaymentId,
      boletoUrl: `https://example.invalid/boleto/${order.id}`,
      boletoLine: "23793.38128 60000.000003 00000.000400 1 84410000009700",
    };
  }
  return {
    providerPaymentId,
    checkoutUrl: `/pagar/sucesso?order=${order.id}&mock=1`,
  };
}
