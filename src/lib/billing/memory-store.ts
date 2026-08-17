import type { BillingStore } from "@/lib/billing/store";
import type {
  BillingOrder,
  BillingSubscription,
  CreditLot,
  LedgerEntry,
  TreasuryTransfer,
} from "@/lib/billing/types";

type MemoryDb = {
  orders: BillingOrder[];
  customers: Array<{
    profileId: string;
    asaasCustomerId: string | null;
    stripeCustomerId: string | null;
  }>;
  subscriptions: BillingSubscription[];
  lots: CreditLot[];
  ledger: LedgerEntry[];
  events: Array<{ provider: string; providerEventId: string }>;
  billed: Array<{
    profileId: string;
    cnpj: string;
    kind: "export" | "enrich";
    searchId: string | null;
  }>;
  profiles: Map<string, { plano: string; creditos: number }>;
  treasury: TreasuryTransfer[];
};

function emptyDb(): MemoryDb {
  return {
    orders: [],
    customers: [],
    subscriptions: [],
    lots: [],
    ledger: [],
    events: [],
    billed: [],
    profiles: new Map(),
    treasury: [],
  };
}

const globalForBilling = globalThis as typeof globalThis & {
  __gridBillingMemory?: MemoryDb;
};

function db(): MemoryDb {
  if (!globalForBilling.__gridBillingMemory) {
    globalForBilling.__gridBillingMemory = emptyDb();
  }
  return globalForBilling.__gridBillingMemory;
}

export function resetBillingMemory(): void {
  globalForBilling.__gridBillingMemory = emptyDb();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const memoryBillingStore: BillingStore = {
  async insertOrder(order) {
    db().orders.push(clone(order));
    return clone(order);
  },
  async updateOrder(id, patch) {
    const row = db().orders.find((o) => o.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return clone(row);
  },
  async getOrder(id) {
    const row = db().orders.find((o) => o.id === id);
    return row ? clone(row) : null;
  },
  async getOrderByProviderPayment(provider, providerPaymentId) {
    const row = db().orders.find(
      (o) => o.provider === provider && o.providerPaymentId === providerPaymentId,
    );
    return row ? clone(row) : null;
  },
  async listOrders(profileId) {
    return db()
      .orders.filter((o) => o.profileId === profileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clone);
  },

  async upsertCustomer(input) {
    const list = db().customers;
    const existing = list.find((c) => c.profileId === input.profileId);
    if (existing) {
      if (input.asaasCustomerId !== undefined) {
        existing.asaasCustomerId = input.asaasCustomerId;
      }
      if (input.stripeCustomerId !== undefined) {
        existing.stripeCustomerId = input.stripeCustomerId;
      }
      return;
    }
    list.push({
      profileId: input.profileId,
      asaasCustomerId: input.asaasCustomerId ?? null,
      stripeCustomerId: input.stripeCustomerId ?? null,
    });
  },
  async getCustomer(profileId) {
    const row = db().customers.find((c) => c.profileId === profileId);
    return row ? clone(row) : null;
  },

  async insertSubscription(sub) {
    db().subscriptions.push(clone(sub));
    return clone(sub);
  },
  async updateSubscription(id, patch) {
    const row = db().subscriptions.find((s) => s.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return clone(row);
  },
  async getActiveSubscription(profileId) {
    const row = db()
      .subscriptions.filter(
        (s) =>
          s.profileId === profileId &&
          (s.status === "active" || s.status === "trialing" || s.status === "past_due"),
      )
      .sort((a, b) => b.currentPeriodEnd.localeCompare(a.currentPeriodEnd))[0];
    return row ? clone(row) : null;
  },
  async getSubscriptionByProviderSub(provider, providerSubId) {
    const row = db().subscriptions.find(
      (s) => s.provider === provider && s.providerSubId === providerSubId,
    );
    return row ? clone(row) : null;
  },

  async insertLot(lot) {
    db().lots.push(clone(lot));
    return clone(lot);
  },
  async listOpenLots(profileId) {
    return db()
      .lots.filter((l) => l.profileId === profileId && l.remaining > 0)
      .map(clone);
  },
  async updateLotRemaining(id, remaining) {
    const row = db().lots.find((l) => l.id === id);
    if (row) row.remaining = remaining;
  },
  async expirePlanLots(profileId, at) {
    const expired: CreditLot[] = [];
    for (const lot of db().lots) {
      if (
        lot.profileId === profileId &&
        (lot.source === "plan_grant" || lot.source === "platform") &&
        lot.remaining > 0
      ) {
        expired.push(clone(lot));
        lot.remaining = 0;
        lot.expiresAt = at;
      }
    }
    return expired;
  },

  async insertLedger(entry) {
    db().ledger.push(clone(entry));
  },
  async listLedger(profileId, limit = 20) {
    return db()
      .ledger.filter((e) => e.profileId === profileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(clone);
  },

  async insertPaymentEvent(input) {
    const exists = db().events.some(
      (e) =>
        e.provider === input.provider && e.providerEventId === input.providerEventId,
    );
    if (exists) return false;
    db().events.push({
      provider: input.provider,
      providerEventId: input.providerEventId,
    });
    return true;
  },

  async isCnpjBilled(profileId, cnpj, kind) {
    return db().billed.some(
      (b) => b.profileId === profileId && b.cnpj === cnpj && b.kind === kind,
    );
  },
  async markCnpjBilled(profileId, cnpj, kind, searchId) {
    if (await this.isCnpjBilled(profileId, cnpj, kind)) return;
    db().billed.push({ profileId, cnpj, kind, searchId });
  },

  async updateProfileCache(profileId, patch) {
    const current = db().profiles.get(profileId) ?? { plano: "free", creditos: 0 };
    db().profiles.set(profileId, { ...current, ...patch });
    const { getMockStore } = await import("@/lib/data/mock-store");
    const store = getMockStore();
    const profile =
      store.profiles.find((p) => p.id === profileId) ?? store.profiles[0];
    if (profile) {
      if (patch.plano !== undefined) profile.plano = patch.plano;
      if (patch.creditos !== undefined) profile.creditos = patch.creditos;
    }
  },
  async getProfileCache(profileId) {
    return db().profiles.get(profileId) ?? null;
  },

  async insertTreasury(row) {
    db().treasury.push(clone(row));
    return clone(row);
  },
  async updateTreasury(id, patch) {
    const row = db().treasury.find((t) => t.id === id);
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    return clone(row);
  },
  async getTreasuryByProviderId(providerTransferId) {
    const row = db().treasury.find((t) => t.providerTransferId === providerTransferId);
    return row ? clone(row) : null;
  },
  async listPendingTreasury() {
    return db()
      .treasury.filter((t) => t.status === "pending" || t.status === "submitted")
      .map(clone);
  },
};
