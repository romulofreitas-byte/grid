import type {
  BillingOrder,
  BillingSubscription,
  CreditLot,
  LedgerEntry,
  TreasuryTransfer,
} from "@/lib/billing/types";

export type BillingStore = {
  insertOrder(order: BillingOrder): Promise<BillingOrder>;
  updateOrder(id: string, patch: Partial<BillingOrder>): Promise<BillingOrder | null>;
  getOrder(id: string): Promise<BillingOrder | null>;
  getOrderByProviderPayment(provider: string, providerPaymentId: string): Promise<BillingOrder | null>;
  listOrders(profileId: string): Promise<BillingOrder[]>;

  upsertCustomer(input: {
    profileId: string;
    asaasCustomerId?: string | null;
    stripeCustomerId?: string | null;
  }): Promise<void>;
  getCustomer(profileId: string): Promise<{
    asaasCustomerId: string | null;
    stripeCustomerId: string | null;
  } | null>;

  insertSubscription(sub: BillingSubscription): Promise<BillingSubscription>;
  updateSubscription(
    id: string,
    patch: Partial<BillingSubscription>,
  ): Promise<BillingSubscription | null>;
  getActiveSubscription(profileId: string): Promise<BillingSubscription | null>;
  getSubscriptionByProviderSub(
    provider: string,
    providerSubId: string,
  ): Promise<BillingSubscription | null>;

  insertLot(lot: CreditLot): Promise<CreditLot>;
  listOpenLots(profileId: string): Promise<CreditLot[]>;
  updateLotRemaining(id: string, remaining: number): Promise<void>;
  expirePlanLots(profileId: string, at: string): Promise<CreditLot[]>;

  insertLedger(entry: LedgerEntry): Promise<void>;
  listLedger(profileId: string, limit?: number): Promise<LedgerEntry[]>;

  insertPaymentEvent(input: {
    provider: string;
    providerEventId: string;
    payload: unknown;
  }): Promise<boolean>;

  isCnpjBilled(profileId: string, cnpj: string, kind: "export" | "enrich"): Promise<boolean>;
  markCnpjBilled(
    profileId: string,
    cnpj: string,
    kind: "export" | "enrich",
    searchId: string | null,
  ): Promise<void>;

  updateProfileCache(
    profileId: string,
    patch: { plano?: string; creditos?: number },
  ): Promise<void>;
  getProfileCache(
    profileId: string,
  ): Promise<{ plano: string; creditos: number } | null>;

  insertTreasury(row: TreasuryTransfer): Promise<TreasuryTransfer>;
  updateTreasury(
    id: string,
    patch: Partial<TreasuryTransfer>,
  ): Promise<TreasuryTransfer | null>;
  getTreasuryByProviderId(providerTransferId: string): Promise<TreasuryTransfer | null>;
  listPendingTreasury(): Promise<TreasuryTransfer[]>;
};
