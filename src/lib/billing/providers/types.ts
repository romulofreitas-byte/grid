import type { PaymentMethod } from "@/lib/billing/catalog";
import type { BillingOrder, NormalizedPaymentEvent } from "@/lib/billing/types";

export type ChargeResult = {
  providerPaymentId?: string;
  providerSubId?: string;
  checkoutUrl?: string;
  pixQr?: string;
  pixCopy?: string;
  boletoUrl?: string;
  boletoLine?: string;
};

export type ProviderCustomer = {
  name: string;
  email: string;
  documento: string;
  documentoTipo: "cpf" | "cnpj";
};

export interface PaymentProvider {
  id: "asaas" | "stripe" | "mock";
  createCustomer(profile: ProviderCustomer): Promise<string>;
  createCharge(
    order: BillingOrder,
    customerId: string,
    method: PaymentMethod,
  ): Promise<ChargeResult>;
  createSubscription(
    order: BillingOrder,
    customerId: string,
    method: PaymentMethod,
  ): Promise<ChargeResult>;
  cancelSubscription(providerSubId: string): Promise<void>;
  parseWebhook(req: Request, rawBody: string): Promise<NormalizedPaymentEvent | null>;
}

export function asaasConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY?.trim());
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function circleConfigured(): boolean {
  return Boolean(process.env.CIRCLE_API_KEY?.trim());
}
