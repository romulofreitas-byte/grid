import type { PaymentMethod } from "@/lib/billing/catalog";
import type { BillingOrder, NormalizedPaymentEvent } from "@/lib/billing/types";
import type {
  ChargeResult,
  PaymentProvider,
  ProviderCustomer,
} from "@/lib/billing/providers/types";

function baseUrl(): string {
  return (
    process.env.ASAAS_BASE_URL?.replace(/\/$/, "") ??
    "https://api.asaas.com/v3"
  );
}

function apiKey(): string {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) throw new Error("ASAAS_API_KEY ausente");
  return key;
}

function billingType(method: PaymentMethod): "PIX" | "BOLETO" | "CREDIT_CARD" {
  if (method === "pix") return "PIX";
  if (method === "boleto") return "BOLETO";
  return "CREDIT_CARD";
}

function dueDate(days = 3): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey(),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as T & { errors?: Array<{ description?: string }> };
  if (!res.ok) {
    const msg = json.errors?.[0]?.description ?? `Asaas ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

type AsaasCustomer = { id: string };
type AsaasPayment = {
  id: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  identificationField?: string;
  status?: string;
};
type AsaasPixQr = { encodedImage?: string; payload?: string };
type AsaasSubscription = { id: string };

async function attachChargeDetails(
  payment: AsaasPayment,
  method: PaymentMethod,
): Promise<ChargeResult> {
  const result: ChargeResult = { providerPaymentId: payment.id };
  if (method === "pix") {
    const qr = await asaasFetch<AsaasPixQr>(`/payments/${payment.id}/pixQrCode`);
    result.pixCopy = qr.payload || undefined;
    result.pixQr = qr.encodedImage
      ? `data:image/png;base64,${qr.encodedImage}`
      : undefined;
  } else if (method === "boleto") {
    result.boletoUrl = payment.bankSlipUrl ?? payment.invoiceUrl;
    result.boletoLine = payment.identificationField;
  } else {
    result.checkoutUrl = payment.invoiceUrl;
  }
  return result;
}

export const asaasProvider: PaymentProvider = {
  id: "asaas",

  async createCustomer(profile: ProviderCustomer) {
    const created = await asaasFetch<AsaasCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: profile.name,
        email: profile.email,
        cpfCnpj: profile.documento,
        notificationDisabled: true,
      }),
    });
    return created.id;
  },

  async createCharge(order: BillingOrder, customerId: string, method: PaymentMethod) {
    const payment = await asaasFetch<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: billingType(method),
        value: order.amountCents / 100,
        dueDate: dueDate(method === "boleto" ? 3 : 1),
        description: `GRID ${order.sku}`,
        externalReference: order.id,
      }),
    });
    return attachChargeDetails(payment, method);
  },

  async createSubscription(order, customerId, method) {
    const sub = await asaasFetch<AsaasSubscription>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: billingType(method),
        value: order.amountCents / 100,
        nextDueDate: dueDate(method === "boleto" ? 3 : 0),
        cycle: "MONTHLY",
        description: `GRID ${order.sku}`,
        externalReference: order.id,
      }),
    });
    const payments = await asaasFetch<{ data?: AsaasPayment[] }>(
      `/subscriptions/${sub.id}/payments`,
    );
    const first = payments.data?.[0];
    if (!first) {
      return { providerPaymentId: sub.id, providerSubId: sub.id };
    }
    const details = await attachChargeDetails(first, method);
    return { ...details, providerSubId: sub.id };
  },

  async cancelSubscription(providerSubId: string) {
    await asaasFetch(`/subscriptions/${providerSubId}`, { method: "DELETE" });
  },

  async parseWebhook(req: Request, rawBody: string): Promise<NormalizedPaymentEvent | null> {
    const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
    const header =
      req.headers.get("asaas-access-token") ?? req.headers.get("access_token");
    if (token && header !== token) {
      throw new Error("Webhook Asaas não autorizado");
    }
    const body = JSON.parse(rawBody) as {
      id?: string;
      event?: string;
      payment?: { id?: string; subscription?: string; status?: string };
      subscription?: { id?: string };
    };
    const eventId = body.id ?? `${body.event ?? "asaas"}-${body.payment?.id ?? crypto.randomUUID()}`;
    const event = body.event ?? "";
    const paymentId = body.payment?.id;
    const subId = body.payment?.subscription ?? body.subscription?.id;

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      return {
        provider: "asaas",
        providerEventId: eventId,
        type: "payment.paid",
        providerPaymentId: paymentId,
        providerSubId: subId,
      };
    }
    if (event === "PAYMENT_OVERDUE") {
      return {
        provider: "asaas",
        providerEventId: eventId,
        type: "payment.overdue",
        providerPaymentId: paymentId,
        providerSubId: subId,
      };
    }
    if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
      return {
        provider: "asaas",
        providerEventId: eventId,
        type: "payment.failed",
        providerPaymentId: paymentId,
        providerSubId: subId,
      };
    }
    if (event === "SUBSCRIPTION_DELETED") {
      return {
        provider: "asaas",
        providerEventId: eventId,
        type: "subscription.deleted",
        providerSubId: subId ?? body.subscription?.id,
      };
    }
    return null;
  },
};
