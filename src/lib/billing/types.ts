import type {
  BillingProvider,
  BillingSku,
  OrderKind,
  PaymentMethod,
} from "@/lib/billing/catalog";

export type OrderStatus = "pending" | "paid" | "expired" | "failed" | "refunded";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type CreditLotSource = "plan_grant" | "pack" | "manual" | "platform";
export type LedgerType = "grant" | "debit" | "expire" | "refund";

export type BillingOrder = {
  id: string;
  profileId: string;
  sku: BillingSku;
  kind: OrderKind;
  provider: BillingProvider;
  method: PaymentMethod | "platform";
  status: OrderStatus;
  amountCents: number;
  currency: "BRL";
  providerPaymentId: string | null;
  providerSubId: string | null;
  pixQr: string | null;
  pixCopy: string | null;
  boletoUrl: string | null;
  boletoLine: string | null;
  checkoutUrl: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type BillingSubscription = {
  id: string;
  profileId: string;
  plan: string;
  status: SubscriptionStatus;
  provider: BillingProvider;
  providerSubId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
};

export type CreditLot = {
  id: string;
  profileId: string;
  qty: number;
  remaining: number;
  source: CreditLotSource;
  expiresAt: string | null;
  orderId: string | null;
  createdAt: string;
};

export type LedgerEntry = {
  id: string;
  profileId: string;
  type: LedgerType;
  amount: number;
  reason: string;
  ref: string | null;
  lotId: string | null;
  createdAt: string;
};

export type TreasuryTransfer = {
  id: string;
  orderId: string;
  amountCents: number;
  status: "pending" | "submitted" | "complete" | "failed";
  providerTransferId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreditBalance = {
  total: number;
  plan: number;
  pack: number;
  plano: string;
  enrichAllowed: boolean;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  periodEndsAt: string | null;
};

export type BillingMe = {
  balance: CreditBalance;
  subscription: BillingSubscription | null;
  orders: BillingOrder[];
  ledger: LedgerEntry[];
};

export type NormalizedPaymentEvent = {
  provider: BillingProvider;
  providerEventId: string;
  type:
    | "payment.paid"
    | "payment.failed"
    | "payment.overdue"
    | "subscription.deleted"
    | "treasury.complete"
    | "treasury.failed";
  providerPaymentId?: string;
  providerSubId?: string;
  providerTransferId?: string;
  /** Checkout order id, e.g. Asaas `externalReference`. */
  orderId?: string;
};

export class InsufficientCreditsError extends Error {
  needed: number;
  available: number;
  constructor(needed: number, available: number) {
    super("Créditos insuficientes");
    this.name = "InsufficientCreditsError";
    this.needed = needed;
    this.available = available;
  }
}

export class EnrichmentNotAllowedError extends Error {
  constructor(message = "Qualificação não está no Treino livre. Escolha um plano.") {
    super(message);
    this.name = "EnrichmentNotAllowedError";
  }
}

export class BillingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BillingError";
    this.status = status;
  }
}
