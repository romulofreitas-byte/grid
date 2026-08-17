import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMethod } from "@/lib/billing/catalog";
import type { BillingOrder, NormalizedPaymentEvent } from "@/lib/billing/types";
import type {
  ChargeResult,
  PaymentProvider,
  ProviderCustomer,
} from "@/lib/billing/providers/types";

function secret(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY ausente");
  return key;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

async function stripeFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret()}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Stripe ${res.status}`);
  }
  return json;
}

type StripeCustomer = { id: string };
type StripeSession = { id: string; url?: string | null };
type StripeSub = { id: string };

function verifySignature(rawBody: string, header: string | null, endpointSecret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k.trim(), rest.join("=")];
    }),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  const signed = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", endpointSecret).update(signed).digest("hex");
  const a = Buffer.from(v1, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  async createCustomer(profile: ProviderCustomer) {
    const created = await stripeFetch<StripeCustomer>("/customers", {
      name: profile.name,
      email: profile.email,
      "metadata[grid_profile]": profile.email,
    });
    return created.id;
  },

  async createCharge(order: BillingOrder, customerId: string, _method: PaymentMethod) {
    const session = await stripeFetch<StripeSession>("/checkout/sessions", {
      mode: "payment",
      customer: customerId,
      success_url: `${siteUrl()}/pagar/sucesso?order=${order.id}`,
      cancel_url: `${siteUrl()}/pagar?sku=${order.sku}&canceled=1`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "brl",
      "line_items[0][price_data][unit_amount]": String(order.amountCents),
      "line_items[0][price_data][product_data][name]": `GRID ${order.sku}`,
      client_reference_id: order.id,
      "metadata[order_id]": order.id,
      "payment_intent_data[metadata][order_id]": order.id,
    });
    return {
      providerPaymentId: session.id,
      checkoutUrl: session.url ?? undefined,
    };
  },

  async createSubscription(order, customerId, _method) {
    const session = await stripeFetch<StripeSession>("/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      success_url: `${siteUrl()}/pagar/sucesso?order=${order.id}`,
      cancel_url: `${siteUrl()}/pagar?sku=${order.sku}&canceled=1`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "brl",
      "line_items[0][price_data][unit_amount]": String(order.amountCents),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": `GRID ${order.sku}`,
      client_reference_id: order.id,
      "metadata[order_id]": order.id,
      "subscription_data[metadata][order_id]": order.id,
    });
    return {
      providerPaymentId: session.id,
      providerSubId: session.id,
      checkoutUrl: session.url ?? undefined,
    };
  },

  async cancelSubscription(providerSubId: string) {
    await stripeFetch<StripeSub>(`/subscriptions/${providerSubId}`, {
      cancel_at_period_end: "true",
    });
  },

  async parseWebhook(req: Request, rawBody: string): Promise<NormalizedPaymentEvent | null> {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const sig = req.headers.get("stripe-signature");
    if (endpointSecret && !verifySignature(rawBody, sig, endpointSecret)) {
      throw new Error("Assinatura Stripe inválida");
    }
    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
    const obj = event.data.object;
    if (event.type === "checkout.session.completed") {
      const paid = obj.payment_status === "paid" || obj.status === "complete";
      if (!paid) return null;
      return {
        provider: "stripe",
        providerEventId: event.id,
        type: "payment.paid",
        providerPaymentId: String(obj.id),
        providerSubId: obj.subscription ? String(obj.subscription) : undefined,
      };
    }
    if (event.type === "invoice.paid") {
      const sub = obj.subscription ? String(obj.subscription) : undefined;
      return {
        provider: "stripe",
        providerEventId: event.id,
        type: "payment.paid",
        providerPaymentId: String(obj.id),
        providerSubId: sub,
      };
    }
    if (event.type === "invoice.payment_failed") {
      return {
        provider: "stripe",
        providerEventId: event.id,
        type: "payment.failed",
        providerPaymentId: String(obj.id),
        providerSubId: obj.subscription ? String(obj.subscription) : undefined,
      };
    }
    if (event.type === "customer.subscription.deleted") {
      return {
        provider: "stripe",
        providerEventId: event.id,
        type: "subscription.deleted",
        providerSubId: String(obj.id),
      };
    }
    return null;
  },
};
