import { getDataSource, hasLiveDatabase } from "@/lib/data";
import { isRuntimeProduction } from "@/lib/env/deploy";
import { isUndefinedTableError } from "@/lib/data/pg";
import {
  addUtcDays,
  isTrialExpired,
  PLATFORM_TRIAL_DAYS,
  subscriptionGrantsAccess,
  trialDaysRemaining,
} from "@/lib/billing/access";
import {
  ENRICH_CREDIT_COST,
  EXPORT_CREDIT_COST,
  getCatalogItem,
  isPackSku,
  isPlanSku,
  isSkuOnSale,
  orderKindFor,
  SKU_OFF_SALE_MESSAGE,
  type BillingSku,
  type PaymentMethod,
  type PlanDefinition,
} from "@/lib/billing/catalog";
import { parseDocumento } from "@/lib/billing/document";
import { isValidPlatformCoupon } from "@/lib/billing/platform-coupon";
import { isPlatformSubscriber } from "@/lib/platform/subscribers";
import { memoryBillingStore } from "@/lib/billing/memory-store";
import { mockProvider } from "@/lib/billing/providers/mock";
import {
  asaasConfigured,
  stripeConfigured,
} from "@/lib/billing/providers/types";
import type { BillingStore } from "@/lib/billing/store";
import {
  BillingError,
  CrmNotAllowedError,
  EnrichmentNotAllowedError,
  InsufficientCreditsError,
  type BillingOrder,
  type CreditBalance,
  type CreditLot,
  type NormalizedPaymentEvent,
} from "@/lib/billing/types";

export function pgBillingEnabled(): boolean {
  if (process.env.BILLING_STORE === "memory") return false;
  return hasLiveDatabase() && getDataSource() !== "mock";
}

export async function getBillingStore(): Promise<BillingStore> {
  if (pgBillingEnabled()) {
    const { pgBillingStore } = await import("@/lib/billing/pg-store");
    return pgBillingStore;
  }
  return memoryBillingStore;
}

function nowIso(): string {
  return new Date().toISOString();
}

function periodEnd(from = new Date()): string {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

function monthEnd(from = new Date()): string {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1)).toISOString();
}

function lotOpen(lot: CreditLot, at = new Date()): boolean {
  if (lot.remaining <= 0) return false;
  if (!lot.expiresAt) return true;
  return new Date(lot.expiresAt).getTime() > at.getTime();
}

function sortLots(lots: CreditLot[]): CreditLot[] {
  return [...lots].sort((a, b) => {
    if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
    if (a.expiresAt && !b.expiresAt) return -1;
    if (!a.expiresAt && b.expiresAt) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function providerForMethod(method: PaymentMethod): "asaas" | "stripe" | "mock" {
  if (method === "card_intl") {
    if (stripeConfigured()) return "stripe";
    if (isRuntimeProduction()) {
      throw new BillingError(
        "Stripe não configurado — pagamento internacional indisponível.",
        503,
      );
    }
    return "mock";
  }
  if (asaasConfigured()) return "asaas";
  if (isRuntimeProduction()) {
    throw new BillingError(
      "Asaas não configurado — checkout indisponível em produção.",
      503,
    );
  }
  return "mock";
}

async function loadProvider(id: "asaas" | "stripe" | "mock") {
  if (id === "asaas") {
    const { asaasProvider } = await import("@/lib/billing/providers/asaas");
    return asaasProvider;
  }
  if (id === "stripe") {
    const { stripeProvider } = await import("@/lib/billing/providers/stripe");
    return stripeProvider;
  }
  return mockProvider;
}

function emptyFreeBalance(credits: number): CreditBalance {
  return {
    total: credits,
    plan: credits,
    pack: 0,
    plano: "free",
    enrichAllowed: false,
    trialDaysLeft: null,
    trialExpired: false,
    periodEndsAt: null,
  };
}

async function syncCache(store: BillingStore, profileId: string): Promise<CreditBalance> {
  const lots = (await store.listOpenLots(profileId)).filter((l) => lotOpen(l));
  let plan = 0;
  let pack = 0;
  for (const lot of lots) {
    if (lot.source === "pack" || lot.source === "manual") pack += lot.remaining;
    else plan += lot.remaining;
  }
  const sub = await store.getActiveSubscription(profileId);
  const grantsAccess = subscriptionGrantsAccess(sub);
  const plano = grantsAccess && sub ? sub.plan : "free";
  const item = getCatalogItem(plano);
  const enrichAllowed = item?.kind === "plan" ? item.enrichAllowed : false;
  const total = plan + pack;
  await store.updateProfileCache(profileId, { plano, creditos: total });
  return {
    total,
    plan,
    pack,
    plano,
    enrichAllowed,
    trialDaysLeft: trialDaysRemaining(sub),
    trialExpired: isTrialExpired(sub) && !grantsAccess,
    periodEndsAt: grantsAccess && sub ? sub.currentPeriodEnd : null,
  };
}

async function grantLot(
  store: BillingStore,
  input: {
    profileId: string;
    qty: number;
    source: CreditLot["source"];
    expiresAt: string | null;
    orderId: string | null;
    reason: string;
    ref?: string | null;
  },
): Promise<void> {
  const lot: CreditLot = {
    id: crypto.randomUUID(),
    profileId: input.profileId,
    qty: input.qty,
    remaining: input.qty,
    source: input.source,
    expiresAt: input.expiresAt,
    orderId: input.orderId,
    createdAt: nowIso(),
  };
  await store.insertLot(lot);
  await store.insertLedger({
    id: crypto.randomUUID(),
    profileId: input.profileId,
    type: "grant",
    amount: input.qty,
    reason: input.reason,
    ref: input.ref ?? input.orderId,
    lotId: lot.id,
    createdAt: nowIso(),
  });
}

export async function ensureStartingCredits(profileId: string): Promise<CreditBalance> {
  try {
    const store = await getBillingStore();
    const lots = await store.listOpenLots(profileId);
    const live = lots.filter((l) => lotOpen(l));
    const sub = await store.getActiveSubscription(profileId);
    if (subscriptionGrantsAccess(sub)) {
      return syncCache(store, profileId);
    }
    if (live.some((l) => l.source === "plan_grant")) {
      return syncCache(store, profileId);
    }
    const free = getCatalogItem("free") as PlanDefinition;
    await grantLot(store, {
      profileId,
      qty: free.credits,
      source: "plan_grant",
      expiresAt: monthEnd(),
      orderId: null,
      reason: "grant_free_period",
    });
    return syncCache(store, profileId);
  } catch (err) {
    if (isUndefinedTableError(err)) {
      const free = getCatalogItem("free") as PlanDefinition;
      return emptyFreeBalance(free.credits);
    }
    throw err;
  }
}

export async function getBalance(profileId: string): Promise<CreditBalance> {
  return ensureStartingCredits(profileId);
}

export async function crmAllowed(profileId: string): Promise<boolean> {
  const balance = await getBalance(profileId);
  return balance.enrichAllowed;
}

export async function assertCrmAccess(profileId: string): Promise<CreditBalance> {
  const balance = await getBalance(profileId);
  if (!balance.enrichAllowed) {
    throw new CrmNotAllowedError(
      balance.trialExpired
        ? "Os 30 dias do Piloto da Plataforma acabaram. Assine o Piloto para continuar."
        : undefined,
    );
  }
  return balance;
}

export async function createCheckout(input: {
  profileId: string;
  email: string;
  nome: string | null;
  sku: string;
  method: PaymentMethod;
  documento?: string;
  coupon?: string;
}): Promise<BillingOrder> {
  const item = getCatalogItem(input.sku);
  if (!item) throw new BillingError("SKU inválido");
  if (item.kind === "plan" && item.sku === "free") {
    throw new BillingError("Treino livre não precisa de pagamento");
  }
  if (!isSkuOnSale(item.sku)) {
    throw new BillingError(SKU_OFF_SALE_MESSAGE);
  }

  const store = await getBillingStore();
  await ensureStartingCredits(input.profileId);

  if (item.kind === "plan" && item.sku === "membro_plataforma") {
    if (!isValidPlatformCoupon(input.coupon)) {
      throw new BillingError("Cupom da Plataforma inválido", 403);
    }
    const subscribed = await isPlatformSubscriber(input.email);
    if (!subscribed) {
      throw new BillingError(
        "Cupom válido só para assinantes ativos da Plataforma com o mesmo e-mail do cadastro",
        403,
      );
    }
    const prior = await store.listOrders(input.profileId);
    if (prior.some((o) => o.kind === "platform" && o.status === "paid")) {
      throw new BillingError(
        "Os 30 dias do Piloto da Plataforma já foram usados. Assine o Piloto.",
        403,
      );
    }
    const order: BillingOrder = {
      id: crypto.randomUUID(),
      profileId: input.profileId,
      sku: item.sku,
      kind: "platform",
      provider: "platform",
      method: "platform",
      status: "pending",
      amountCents: 0,
      currency: "BRL",
      providerPaymentId: `plat_${crypto.randomUUID()}`,
      providerSubId: null,
      pixQr: null,
      pixCopy: null,
      boletoUrl: null,
      boletoLine: null,
      checkoutUrl: null,
      paidAt: null,
      createdAt: nowIso(),
    };
    await store.insertOrder(order);
    await applyPaymentPaid(order.id);
    const paid = await store.getOrder(order.id);
    if (!paid) throw new BillingError("Falha ao ativar o plano da Plataforma", 500);
    return paid;
  }

  const method = input.method;
  const providerId = providerForMethod(method);
  const parsedDoc = parseDocumento(input.documento);
  if (providerId === "asaas" && !parsedDoc) {
    throw new BillingError("CPF ou CNPJ válido é obrigatório para Pix, cartão e boleto");
  }

  const sku = item.sku as BillingSku;
  const order: BillingOrder = {
    id: crypto.randomUUID(),
    profileId: input.profileId,
    sku,
    kind: orderKindFor(sku),
    provider: providerId,
    method,
    status: "pending",
    amountCents: item.priceCents,
    currency: "BRL",
    providerPaymentId: null,
    providerSubId: null,
    pixQr: null,
    pixCopy: null,
    boletoUrl: null,
    boletoLine: null,
    checkoutUrl: null,
    paidAt: null,
    createdAt: nowIso(),
  };
  await store.insertOrder(order);

  const provider = await loadProvider(providerId);
  const existing = await store.getCustomer(input.profileId);
  let customerId =
    providerId === "stripe" ? existing?.stripeCustomerId : existing?.asaasCustomerId;
  if (!customerId) {
    customerId = await provider.createCustomer({
      name: input.nome ?? "Piloto GRID",
      email: input.email,
      documento: parsedDoc?.digits ?? "00000000000",
      documentoTipo: parsedDoc?.tipo ?? "cpf",
    });
    await store.upsertCustomer({
      profileId: input.profileId,
      asaasCustomerId: providerId === "asaas" ? customerId : undefined,
      stripeCustomerId: providerId === "stripe" ? customerId : undefined,
    });
  }

  const charge =
    order.kind === "subscription_cycle"
      ? await provider.createSubscription(order, customerId, method)
      : await provider.createCharge(order, customerId, method);

  const updated = await store.updateOrder(order.id, {
    providerPaymentId: charge.providerPaymentId || null,
    providerSubId: charge.providerSubId ?? null,
    pixQr: charge.pixQr ?? null,
    pixCopy: charge.pixCopy ?? null,
    boletoUrl: charge.boletoUrl ?? null,
    boletoLine: charge.boletoLine ?? null,
    checkoutUrl: charge.checkoutUrl ?? null,
  });
  if (!updated) throw new BillingError("Pedido não encontrado", 500);

  if (
    !isRuntimeProduction() &&
    providerId === "mock" &&
    (method === "card_br" || method === "card_intl")
  ) {
    await applyPaymentPaid(updated.id);
    return (await store.getOrder(updated.id)) ?? updated;
  }
  return updated;
}

export async function getOrderForProfile(
  orderId: string,
  profileId: string,
): Promise<BillingOrder | null> {
  const store = await getBillingStore();
  const order = await store.getOrder(orderId);
  if (!order || order.profileId !== profileId) return null;

  if (
    !isRuntimeProduction() &&
    order.status === "pending" &&
    order.provider === "mock" &&
    order.method !== "boleto" &&
    Date.now() - new Date(order.createdAt).getTime() > 2_500
  ) {
    await applyPaymentPaid(order.id);
    return store.getOrder(order.id);
  }
  return order;
}

export async function simulateMockPayment(orderId: string, profileId: string): Promise<BillingOrder> {
  if (isRuntimeProduction()) {
    throw new BillingError("Confirmação demo indisponível em produção", 403);
  }
  const store = await getBillingStore();
  const order = await store.getOrder(orderId);
  if (!order || order.profileId !== profileId) {
    throw new BillingError("Pedido não encontrado", 404);
  }
  if (order.provider !== "mock") {
    throw new BillingError("Só a demo pode confirmar pagamento manualmente", 403);
  }
  await applyPaymentPaid(order.id);
  const paid = await store.getOrder(order.id);
  if (!paid) throw new BillingError("Pedido não encontrado", 404);
  return paid;
}

export async function applyPaymentPaid(orderId: string): Promise<void> {
  const store = await getBillingStore();
  const order = await store.getOrder(orderId);
  if (!order) return;
  if (order.status === "paid") return;

  const item = getCatalogItem(order.sku);
  if (!item) return;

  await store.updateOrder(order.id, { status: "paid", paidAt: nowIso() });

  if (item.kind === "pack") {
    await grantLot(store, {
      profileId: order.profileId,
      qty: item.credits,
      source: "pack",
      expiresAt: null,
      orderId: order.id,
      reason: `pack_${item.sku}`,
    });
    await syncCache(store, order.profileId);
    await enqueueTreasurySweep(store, order);
    return;
  }

  const plan = item as PlanDefinition;
  const isPlatform = plan.sku === "membro_plataforma";
  const start = nowIso();
  const end = isPlatform
    ? addUtcDays(new Date(), PLATFORM_TRIAL_DAYS).toISOString()
    : periodEnd();
  const status = isPlatform ? "trialing" : "active";
  const expired = await store.expirePlanLots(order.profileId, start);
  for (const lot of expired) {
    if (lot.remaining > 0) {
      await store.insertLedger({
        id: crypto.randomUUID(),
        profileId: order.profileId,
        type: "expire",
        amount: lot.remaining,
        reason: "plan_renew_reset",
        ref: order.id,
        lotId: lot.id,
        createdAt: start,
      });
    }
  }

  const existing = await store.getActiveSubscription(order.profileId);
  if (existing) {
    await store.updateSubscription(existing.id, {
      plan: plan.sku,
      status,
      provider: order.provider,
      providerSubId: order.providerSubId,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
    });
  } else {
    await store.insertSubscription({
      id: crypto.randomUUID(),
      profileId: order.profileId,
      plan: plan.sku,
      status,
      provider: order.provider,
      providerSubId: order.providerSubId,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
    });
  }

  await grantLot(store, {
    profileId: order.profileId,
    qty: plan.credits,
    source: isPlatform ? "platform" : "plan_grant",
    expiresAt: end,
    orderId: order.id,
    reason: `plan_${plan.sku}`,
  });
  await syncCache(store, order.profileId);
  if (order.amountCents > 0) {
    await enqueueTreasurySweep(store, order);
  }
}

async function enqueueTreasurySweep(store: BillingStore, order: BillingOrder): Promise<void> {
  const min = Number(process.env.CIRCLE_SWEEP_MIN_CENTS ?? "1");
  if (order.amountCents < min) return;
  const row = await store.insertTreasury({
    id: crypto.randomUUID(),
    orderId: order.id,
    amountCents: order.amountCents,
    status: "pending",
    providerTransferId: null,
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  try {
    const { submitCircleSweep } = await import("@/lib/billing/treasury");
    await submitCircleSweep(row);
  } catch (err) {
    await store.updateTreasury(row.id, {
      status: "failed",
      error: err instanceof Error ? err.message : "treasury_error",
    });
  }
}

async function maybeRenewSubscription(
  provider: string,
  providerSubId: string,
): Promise<void> {
  const store = await getBillingStore();
  const sub = await store.getSubscriptionByProviderSub(provider, providerSubId);
  if (!sub) return;
  if (sub.provider === "platform") return;
  const age = Date.now() - new Date(sub.currentPeriodStart).getTime();
  if (age < 20 * 24 * 60 * 60 * 1000) return;
  const item = getCatalogItem(sub.plan);
  if (!item || item.kind !== "plan") return;
  if (item.sku === "membro_plataforma") return;
  const start = nowIso();
  const end = periodEnd();
  const expired = await store.expirePlanLots(sub.profileId, start);
  for (const lot of expired) {
    if (lot.remaining > 0) {
      await store.insertLedger({
        id: crypto.randomUUID(),
        profileId: sub.profileId,
        type: "expire",
        amount: lot.remaining,
        reason: "plan_renew_reset",
        ref: providerSubId,
        lotId: lot.id,
        createdAt: start,
      });
    }
  }
  await store.updateSubscription(sub.id, {
    status: "active",
    currentPeriodStart: start,
    currentPeriodEnd: end,
  });
  await grantLot(store, {
    profileId: sub.profileId,
    qty: item.credits,
    source: "plan_grant",
    expiresAt: end,
    orderId: null,
    reason: `plan_renew_${item.sku}`,
    ref: providerSubId,
  });
  await syncCache(store, sub.profileId);
}

async function findOrderForEvent(
  store: BillingStore,
  event: NormalizedPaymentEvent,
): Promise<BillingOrder | null> {
  if (event.providerPaymentId) {
    const byPay = await store.getOrderByProviderPayment(
      event.provider,
      event.providerPaymentId,
    );
    if (byPay) return byPay;
  }
  if (event.orderId) {
    const byRef = await store.getOrder(event.orderId);
    if (byRef && byRef.provider === event.provider) return byRef;
  }
  return null;
}

export async function handleNormalizedEvent(
  event: NormalizedPaymentEvent,
  payload: unknown,
): Promise<void> {
  const store = await getBillingStore();
  const fresh = await store.insertPaymentEvent({
    provider: event.provider,
    providerEventId: event.providerEventId,
    payload,
  });
  if (!fresh) return;

  if (event.type === "payment.paid") {
    const order = await findOrderForEvent(store, event);
    if (order) {
      if (event.providerPaymentId && order.providerPaymentId !== event.providerPaymentId) {
        await store.updateOrder(order.id, {
          providerPaymentId: event.providerPaymentId,
        });
      }
      if (event.providerSubId && order.providerSubId !== event.providerSubId) {
        await store.updateOrder(order.id, { providerSubId: event.providerSubId });
      }
      await applyPaymentPaid(order.id);
      if (event.providerSubId) {
        const sub = await store.getActiveSubscription(order.profileId);
        if (sub) {
          await store.updateSubscription(sub.id, { providerSubId: event.providerSubId });
        }
      }
      return;
    }
    if (event.providerSubId && event.providerPaymentId) {
      await maybeRenewSubscription(event.provider, event.providerSubId);
    }
    return;
  }
  if (event.type === "payment.failed" || event.type === "payment.overdue") {
    const order = await findOrderForEvent(store, event);
    if (order && order.status === "pending") {
      await store.updateOrder(order.id, {
        status: event.type === "payment.overdue" ? "expired" : "failed",
      });
    }
    if (event.providerSubId) {
      const sub = await store.getSubscriptionByProviderSub(
        event.provider,
        event.providerSubId,
      );
      if (sub) await store.updateSubscription(sub.id, { status: "past_due" });
    }
    return;
  }
  if (event.type === "subscription.deleted" && event.providerSubId) {
    const sub = await store.getSubscriptionByProviderSub(
      event.provider,
      event.providerSubId,
    );
    if (sub) await store.updateSubscription(sub.id, { status: "canceled" });
    return;
  }
  if (event.type === "treasury.complete" && event.providerTransferId) {
    const row = await store.getTreasuryByProviderId(event.providerTransferId);
    if (row) await store.updateTreasury(row.id, { status: "complete" });
  }
  if (event.type === "treasury.failed" && event.providerTransferId) {
    const row = await store.getTreasuryByProviderId(event.providerTransferId);
    if (row) await store.updateTreasury(row.id, { status: "failed" });
  }
}

export async function debitCredits(
  profileId: string,
  amount: number,
  reason: string,
  ref: string | null,
): Promise<CreditBalance> {
  if (amount <= 0) return getBalance(profileId);
  const store = await getBillingStore();
  await ensureStartingCredits(profileId);
  const lots = sortLots((await store.listOpenLots(profileId)).filter((l) => lotOpen(l)));
  const available = lots.reduce((sum, lot) => sum + lot.remaining, 0);
  if (available < amount) {
    throw new InsufficientCreditsError(amount, available);
  }
  let left = amount;
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(lot.remaining, left);
    await store.updateLotRemaining(lot.id, lot.remaining - take);
    await store.insertLedger({
      id: crypto.randomUUID(),
      profileId,
      type: "debit",
      amount: take,
      reason,
      ref,
      lotId: lot.id,
      createdAt: nowIso(),
    });
    left -= take;
  }
  return syncCache(store, profileId);
}

export async function filterQualifiedCnpjs(
  profileId: string,
  cnpjs: string[],
): Promise<string[]> {
  const store = await getBillingStore();
  const unique = [
    ...new Set(cnpjs.map((c) => c.replace(/\D/g, "").padStart(14, "0"))),
  ];
  const qualified: string[] = [];
  for (const cnpj of unique) {
    if (await store.isCnpjBilled(profileId, cnpj, "enrich")) qualified.push(cnpj);
  }
  return qualified;
}

export async function debitExport(
  profileId: string,
  cnpjs: string[],
  searchId: string,
): Promise<{ charged: number; skipped: number; balance: CreditBalance }> {
  const store = await getBillingStore();
  const unique = [...new Set(cnpjs.map((c) => c.replace(/\D/g, "").padStart(14, "0")))];
  const qualified = await filterQualifiedCnpjs(profileId, unique);
  const toCharge: string[] = [];
  for (const cnpj of qualified) {
    if (!(await store.isCnpjBilled(profileId, cnpj, "export"))) toCharge.push(cnpj);
  }
  const needed = toCharge.length * EXPORT_CREDIT_COST;
  const balance = needed
    ? await debitCredits(profileId, needed, "export", searchId)
    : await getBalance(profileId);
  for (const cnpj of toCharge) {
    await store.markCnpjBilled(profileId, cnpj, "export", searchId);
  }
  return { charged: toCharge.length, skipped: unique.length - toCharge.length, balance };
}

export async function debitEnrich(
  profileId: string,
  cnpjs: string[],
  searchId: string | null,
  options?: { forceCharge?: boolean },
): Promise<CreditBalance> {
  const balance = await getBalance(profileId);
  if (!balance.enrichAllowed) {
    throw new EnrichmentNotAllowedError(
      balance.trialExpired
        ? "Os 30 dias do Piloto da Plataforma acabaram. Assine o Piloto para continuar."
        : undefined,
    );
  }
  const unique = [...new Set(cnpjs.map((c) => c.replace(/\D/g, "").padStart(14, "0")))];
  const store = await getBillingStore();
  const toCharge: string[] = [];
  for (const cnpj of unique) {
    if (
      options?.forceCharge ||
      !(await store.isCnpjBilled(profileId, cnpj, "enrich"))
    ) {
      toCharge.push(cnpj);
    }
  }
  const needed = toCharge.length * ENRICH_CREDIT_COST;
  const result = needed
    ? await debitCredits(profileId, needed, "enrich", searchId)
    : await getBalance(profileId);
  for (const cnpj of toCharge) {
    await store.markCnpjBilled(profileId, cnpj, "enrich", searchId);
  }
  return result;
}

export async function cancelSubscription(profileId: string): Promise<void> {
  const store = await getBillingStore();
  const sub = await store.getActiveSubscription(profileId);
  if (!sub) throw new BillingError("Nenhuma assinatura ativa", 404);
  if (sub.providerSubId && (sub.provider === "asaas" || sub.provider === "stripe")) {
    const provider = await loadProvider(sub.provider);
    await provider.cancelSubscription(sub.providerSubId);
  }
  await store.updateSubscription(sub.id, { cancelAtPeriodEnd: true });
}

export async function getBillingMe(profileId: string) {
  const store = await getBillingStore();
  const balance = await getBalance(profileId);
  const sub = await store.getActiveSubscription(profileId);
  const orders = await store.listOrders(profileId);
  const ledger = await store.listLedger(profileId, 30);
  return { balance, subscription: sub, orders, ledger };
}

export { isPackSku, isPlanSku, EXPORT_CREDIT_COST, ENRICH_CREDIT_COST };
