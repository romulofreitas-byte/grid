import { query } from "@/lib/data/pg";
import type { BillingStore } from "@/lib/billing/store";
import type {
  BillingProvider,
  BillingSku,
  OrderKind,
  PaymentMethod,
} from "@/lib/billing/catalog";
import type {
  BillingOrder,
  BillingSubscription,
  CreditLot,
  CreditLotSource,
  LedgerEntry,
  LedgerType,
  OrderStatus,
  SubscriptionStatus,
  TreasuryTransfer,
} from "@/lib/billing/types";

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapOrder(r: Record<string, unknown>): BillingOrder {
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    sku: r.sku as BillingSku,
    kind: r.kind as OrderKind,
    provider: r.provider as BillingProvider,
    method: r.method as PaymentMethod | "platform",
    status: r.status as OrderStatus,
    amountCents: Number(r.amount_cents),
    currency: "BRL",
    providerPaymentId: r.provider_payment_id == null ? null : String(r.provider_payment_id),
    providerSubId: r.provider_sub_id == null ? null : String(r.provider_sub_id),
    pixQr: r.pix_qr == null ? null : String(r.pix_qr),
    pixCopy: r.pix_copy == null ? null : String(r.pix_copy),
    boletoUrl: r.boleto_url == null ? null : String(r.boleto_url),
    boletoLine: r.boleto_line == null ? null : String(r.boleto_line),
    checkoutUrl: r.checkout_url == null ? null : String(r.checkout_url),
    paidAt: r.paid_at == null ? null : iso(r.paid_at),
    createdAt: iso(r.created_at),
  };
}

function mapSub(r: Record<string, unknown>): BillingSubscription {
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    plan: String(r.plan),
    status: r.status as SubscriptionStatus,
    provider: r.provider as BillingProvider,
    providerSubId: r.provider_sub_id == null ? null : String(r.provider_sub_id),
    currentPeriodStart: iso(r.current_period_start),
    currentPeriodEnd: iso(r.current_period_end),
    cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
  };
}

function mapLot(r: Record<string, unknown>): CreditLot {
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    qty: Number(r.qty),
    remaining: Number(r.remaining),
    source: r.source as CreditLotSource,
    expiresAt: r.expires_at == null ? null : iso(r.expires_at),
    orderId: r.order_id == null ? null : String(r.order_id),
    createdAt: iso(r.created_at),
  };
}

function mapLedger(r: Record<string, unknown>): LedgerEntry {
  return {
    id: String(r.id),
    profileId: String(r.profile_id),
    type: r.type as LedgerType,
    amount: Number(r.amount),
    reason: String(r.reason),
    ref: r.ref == null ? null : String(r.ref),
    lotId: r.lot_id == null ? null : String(r.lot_id),
    createdAt: iso(r.created_at),
  };
}

function mapTreasury(r: Record<string, unknown>): TreasuryTransfer {
  return {
    id: String(r.id),
    orderId: String(r.order_id),
    amountCents: Number(r.amount_cents),
    status: r.status as TreasuryTransfer["status"],
    providerTransferId:
      r.provider_transfer_id == null ? null : String(r.provider_transfer_id),
    error: r.error == null ? null : String(r.error),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export const pgBillingStore: BillingStore = {
  async insertOrder(order) {
    const { rows } = await query(
      `insert into billing_orders (
         id, profile_id, sku, kind, provider, method, status, amount_cents, currency,
         provider_payment_id, provider_sub_id, pix_qr, pix_copy, boleto_url, boleto_line,
         checkout_url, paid_at, created_at
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
       ) returning *`,
      [
        order.id,
        order.profileId,
        order.sku,
        order.kind,
        order.provider,
        order.method,
        order.status,
        order.amountCents,
        order.currency,
        order.providerPaymentId,
        order.providerSubId,
        order.pixQr,
        order.pixCopy,
        order.boletoUrl,
        order.boletoLine,
        order.checkoutUrl,
        order.paidAt,
        order.createdAt,
      ],
    );
    return mapOrder(rows[0]);
  },
  async updateOrder(id, patch) {
    const current = await this.getOrder(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    const { rows } = await query(
      `update billing_orders set
         status=$2, provider_payment_id=$3, provider_sub_id=$4, pix_qr=$5, pix_copy=$6,
         boleto_url=$7, boleto_line=$8, checkout_url=$9, paid_at=$10
       where id=$1 returning *`,
      [
        id,
        next.status,
        next.providerPaymentId,
        next.providerSubId,
        next.pixQr,
        next.pixCopy,
        next.boletoUrl,
        next.boletoLine,
        next.checkoutUrl,
        next.paidAt,
      ],
    );
    return rows[0] ? mapOrder(rows[0]) : null;
  },
  async claimOrderPaid(id, paidAt) {
    const { rows } = await query(
      `update billing_orders set status='paid', paid_at=$2
       where id=$1 and status <> 'paid'
       returning *`,
      [id, paidAt],
    );
    return rows[0] ? mapOrder(rows[0]) : null;
  },
  async getOrder(id) {
    const { rows } = await query("select * from billing_orders where id=$1", [id]);
    return rows[0] ? mapOrder(rows[0]) : null;
  },
  async getOrderByProviderPayment(provider, providerPaymentId) {
    const { rows } = await query(
      `select * from billing_orders
       where provider=$1 and provider_payment_id=$2
       limit 1`,
      [provider, providerPaymentId],
    );
    return rows[0] ? mapOrder(rows[0]) : null;
  },
  async listOrders(profileId) {
    const { rows } = await query(
      "select * from billing_orders where profile_id=$1 order by created_at desc",
      [profileId],
    );
    return rows.map(mapOrder);
  },

  async upsertCustomer(input) {
    await query(
      `insert into billing_customers (profile_id, asaas_customer_id, stripe_customer_id)
       values ($1,$2,$3)
       on conflict (profile_id) do update set
         asaas_customer_id = coalesce(excluded.asaas_customer_id, billing_customers.asaas_customer_id),
         stripe_customer_id = coalesce(excluded.stripe_customer_id, billing_customers.stripe_customer_id)`,
      [
        input.profileId,
        input.asaasCustomerId ?? null,
        input.stripeCustomerId ?? null,
      ],
    );
  },
  async getCustomer(profileId) {
    const { rows } = await query(
      "select asaas_customer_id, stripe_customer_id from billing_customers where profile_id=$1",
      [profileId],
    );
    if (!rows[0]) return null;
    return {
      asaasCustomerId: rows[0].asaas_customer_id
        ? String(rows[0].asaas_customer_id)
        : null,
      stripeCustomerId: rows[0].stripe_customer_id
        ? String(rows[0].stripe_customer_id)
        : null,
    };
  },

  async insertSubscription(sub) {
    const { rows } = await query(
      `insert into billing_subscriptions (
         id, profile_id, plan, status, provider, provider_sub_id,
         current_period_start, current_period_end, cancel_at_period_end
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [
        sub.id,
        sub.profileId,
        sub.plan,
        sub.status,
        sub.provider,
        sub.providerSubId,
        sub.currentPeriodStart,
        sub.currentPeriodEnd,
        sub.cancelAtPeriodEnd,
      ],
    );
    return mapSub(rows[0]);
  },
  async updateSubscription(id, patch) {
    const { rows: current } = await query(
      "select * from billing_subscriptions where id=$1",
      [id],
    );
    if (!current[0]) return null;
    const next = { ...mapSub(current[0]), ...patch };
    const { rows } = await query(
      `update billing_subscriptions set
         plan=$2, status=$3, provider=$4, provider_sub_id=$5,
         current_period_start=$6, current_period_end=$7, cancel_at_period_end=$8
       where id=$1 returning *`,
      [
        id,
        next.plan,
        next.status,
        next.provider,
        next.providerSubId,
        next.currentPeriodStart,
        next.currentPeriodEnd,
        next.cancelAtPeriodEnd,
      ],
    );
    return rows[0] ? mapSub(rows[0]) : null;
  },
  async getActiveSubscription(profileId) {
    const { rows } = await query(
      `select * from billing_subscriptions
       where profile_id=$1 and status in ('active','trialing','past_due')
       order by current_period_end desc
       limit 1`,
      [profileId],
    );
    return rows[0] ? mapSub(rows[0]) : null;
  },
  async getSubscriptionByProviderSub(provider, providerSubId) {
    const { rows } = await query(
      `select * from billing_subscriptions
       where provider=$1 and provider_sub_id=$2
       limit 1`,
      [provider, providerSubId],
    );
    return rows[0] ? mapSub(rows[0]) : null;
  },

  async insertLot(lot) {
    const { rows } = await query(
      `insert into credit_lots (
         id, profile_id, qty, remaining, source, expires_at, order_id, created_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [
        lot.id,
        lot.profileId,
        lot.qty,
        lot.remaining,
        lot.source,
        lot.expiresAt,
        lot.orderId,
        lot.createdAt,
      ],
    );
    return mapLot(rows[0]);
  },
  async listOpenLots(profileId) {
    const { rows } = await query(
      `select * from credit_lots
       where profile_id=$1 and remaining > 0
       order by expires_at nulls last, created_at`,
      [profileId],
    );
    return rows.map(mapLot);
  },
  async listLots(profileId) {
    const { rows } = await query(
      `select * from credit_lots
       where profile_id=$1
       order by expires_at nulls last, created_at`,
      [profileId],
    );
    return rows.map(mapLot);
  },
  async tryDebitLot(id, amount) {
    if (!Number.isInteger(amount) || amount <= 0) return false;
    const { rowCount } = await query(
      `update credit_lots set remaining = remaining - $2
       where id=$1 and remaining >= $2`,
      [id, amount],
    );
    return (rowCount ?? 0) > 0;
  },
  async expirePlanLots(profileId, at) {
    const { rows } = await query(
      `select * from credit_lots
       where profile_id=$1 and source in ('plan_grant','platform') and remaining > 0`,
      [profileId],
    );
    await query(
      `update credit_lots
       set remaining = 0, expires_at = $2
       where profile_id=$1 and source in ('plan_grant','platform') and remaining > 0`,
      [profileId, at],
    );
    return rows.map(mapLot);
  },

  async insertLedger(entry) {
    await query(
      `insert into credit_ledger (id, profile_id, type, amount, reason, ref, lot_id, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        entry.id,
        entry.profileId,
        entry.type,
        entry.amount,
        entry.reason,
        entry.ref,
        entry.lotId,
        entry.createdAt,
      ],
    );
  },
  async listLedger(profileId, limit = 20) {
    const { rows } = await query(
      `select * from credit_ledger
       where profile_id=$1
       order by created_at desc
       limit $2`,
      [profileId, limit],
    );
    return rows.map(mapLedger);
  },

  async insertPaymentEvent(input) {
    const { rowCount } = await query(
      `insert into payment_events (provider, provider_event_id, payload)
       values ($1,$2,$3::jsonb)
       on conflict (provider, provider_event_id) do nothing`,
      [input.provider, input.providerEventId, JSON.stringify(input.payload ?? {})],
    );
    return (rowCount ?? 0) > 0;
  },

  async isCnpjBilled(profileId, cnpj, kind) {
    const { rows } = await query<{ n: number }>(
      `select count(*)::int as n from billed_cnpjs
       where profile_id=$1 and cnpj=$2 and kind=$3`,
      [profileId, cnpj, kind],
    );
    return Number(rows[0]?.n ?? 0) > 0;
  },
  async listBilledCnpjs(profileId, cnpjs, kind) {
    if (cnpjs.length === 0) return [];
    const { rows } = await query<{ cnpj: string }>(
      `select cnpj from billed_cnpjs
       where profile_id=$1 and kind=$2 and cnpj = any($3::text[])`,
      [profileId, kind, cnpjs],
    );
    return rows.map((r) => r.cnpj);
  },
  async markCnpjBilled(profileId, cnpj, kind, searchId) {
    await query(
      `insert into billed_cnpjs (profile_id, cnpj, kind, search_id)
       values ($1,$2,$3,$4)
       on conflict (profile_id, cnpj, kind) do nothing`,
      [profileId, cnpj, kind, searchId],
    );
  },

  async updateProfileCache(profileId, patch) {
    const sets: string[] = [];
    const params: unknown[] = [profileId];
    if (patch.plano !== undefined) {
      params.push(patch.plano);
      sets.push(`plano = $${params.length}`);
    }
    if (patch.creditos !== undefined) {
      params.push(patch.creditos);
      sets.push(`creditos = $${params.length}`);
    }
    if (!sets.length) return;
    await query(`update profiles set ${sets.join(", ")} where id=$1`, params);
  },
  async getProfileCache(profileId) {
    const { rows } = await query(
      "select plano, creditos from profiles where id=$1",
      [profileId],
    );
    if (!rows[0]) return null;
    return { plano: String(rows[0].plano), creditos: Number(rows[0].creditos) };
  },

  async insertTreasury(row) {
    const { rows } = await query(
      `insert into treasury_transfers (
         id, order_id, amount_cents, status, provider_transfer_id, error, created_at, updated_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [
        row.id,
        row.orderId,
        row.amountCents,
        row.status,
        row.providerTransferId,
        row.error,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return mapTreasury(rows[0]);
  },
  async updateTreasury(id, patch) {
    const { rows: current } = await query(
      "select * from treasury_transfers where id=$1",
      [id],
    );
    if (!current[0]) return null;
    const next = { ...mapTreasury(current[0]), ...patch, updatedAt: new Date().toISOString() };
    const { rows } = await query(
      `update treasury_transfers set
         status=$2, provider_transfer_id=$3, error=$4, updated_at=$5
       where id=$1 returning *`,
      [id, next.status, next.providerTransferId, next.error, next.updatedAt],
    );
    return rows[0] ? mapTreasury(rows[0]) : null;
  },
  async getTreasuryByProviderId(providerTransferId) {
    const { rows } = await query(
      "select * from treasury_transfers where provider_transfer_id=$1 limit 1",
      [providerTransferId],
    );
    return rows[0] ? mapTreasury(rows[0]) : null;
  },
  async listPendingTreasury() {
    const { rows } = await query(
      `select * from treasury_transfers
       where status in ('pending','submitted')
       order by created_at`,
    );
    return rows.map(mapTreasury);
  },
};
