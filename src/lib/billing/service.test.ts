import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_USER_ID } from "@/lib/data/pg";
import { resetBillingMemory } from "@/lib/billing/memory-store";
import {
  assertCrmAccess,
  createCheckout,
  crmAllowed,
  debitCredits,
  debitEnrich,
  debitExport,
  getBalance,
  getBillingMe,
  handleNormalizedEvent,
} from "@/lib/billing/service";
import {
  CrmNotAllowedError,
  EnrichmentNotAllowedError,
  InsufficientCreditsError,
} from "@/lib/billing/types";

vi.mock("@/lib/platform/subscribers", () => ({
  isPlatformSubscriber: vi.fn(async (email: string | null | undefined) => {
    return email?.trim().toLowerCase() === "piloto@mundopodium.com.br";
  }),
  normalizeSubscriberEmail: (raw: string | null | undefined) =>
    raw?.trim().toLowerCase() ?? null,
  shouldShowPlatformCouponBanner: () => false,
}));

const profileId = LOCAL_USER_ID;

beforeEach(() => {
  process.env.DATA_SOURCE = "mock";
  process.env.BILLING_STORE = "memory";
  delete process.env.ASAAS_API_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.CIRCLE_API_KEY;
  process.env.BILLING_PLATFORM_COUPON = "PILOTOPODIUM";
  resetBillingMemory();
});

afterEach(() => {
  vi.useRealTimers();
  resetBillingMemory();
});

describe("billing service", () => {
  it("grants 25 free credits on first balance", async () => {
    const bal = await getBalance(profileId);
    expect(bal.total).toBe(25);
    expect(bal.plano).toBe("free");
    expect(bal.enrichAllowed).toBe(false);
  });

  it("pays a mock card checkout and grants plan credits", async () => {
    const order = await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "piloto",
      method: "card_br",
    });
    expect(order.status).toBe("paid");
    const bal = await getBalance(profileId);
    expect(bal.plano).toBe("piloto");
    expect(bal.total).toBe(900);
    expect(bal.enrichAllowed).toBe(true);
  });

  it("keeps pack credits after a plan reset", async () => {
    const pack = await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "pack_100",
      method: "card_br",
    });
    expect(pack.status).toBe("paid");
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "piloto",
      method: "card_br",
    });
    const bal = await getBalance(profileId);
    expect(bal.pack).toBe(100);
    expect(bal.plan).toBe(900);
    expect(bal.total).toBe(1000);
  });

  it("debits export once per CNPJ", async () => {
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "piloto",
      method: "card_br",
    });
    const first = await debitExport(profileId, ["12345678000190"], "search-1");
    expect(first.charged).toBe(1);
    const second = await debitExport(profileId, ["12345678000190"], "search-1");
    expect(second.charged).toBe(0);
    expect(second.balance.total).toBe(899);
  });

  it("shares export billing between CSV and list push", async () => {
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "piloto",
      method: "card_br",
    });
    const csv = await debitExport(profileId, ["12345678000190", "98765432000100"], "search-csv");
    expect(csv.charged).toBe(2);
    const push = await debitExport(profileId, ["12345678000190", "98765432000100"], "search-push");
    expect(push.charged).toBe(0);
    expect(push.skipped).toBe(2);
    expect(push.balance.total).toBe(898);
  });

  it("blocks enrichment on free", async () => {
    await getBalance(profileId);
    await expect(
      debitEnrich(profileId, ["12345678000190"], null),
    ).rejects.toBeInstanceOf(EnrichmentNotAllowedError);
  });

  it("blocks CRM on free and allows it on Piloto", async () => {
    await getBalance(profileId);
    expect(await crmAllowed(profileId)).toBe(false);
    await expect(assertCrmAccess(profileId)).rejects.toBeInstanceOf(CrmNotAllowedError);

    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "piloto",
      method: "card_br",
    });
    expect(await crmAllowed(profileId)).toBe(true);
    await expect(assertCrmAccess(profileId)).resolves.toMatchObject({
      enrichAllowed: true,
      plano: "piloto",
    });
  });

  it("debits enrich once per CNPJ", async () => {
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "piloto",
      method: "card_br",
    });
    const first = await debitEnrich(profileId, ["12345678000190"], "s1");
    expect(first.total).toBe(898);
    const second = await debitEnrich(profileId, ["12345678000190"], "s1");
    expect(second.total).toBe(898);
  });

  it("forceCharge debits enrich again for an already-billed CNPJ", async () => {
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "piloto",
      method: "card_br",
    });
    const first = await debitEnrich(profileId, ["12345678000190"], "s1");
    expect(first.total).toBe(898);
    const refresh = await debitEnrich(profileId, ["12345678000190"], "s1", {
      forceCharge: true,
    });
    expect(refresh.total).toBe(896);
  });

  it("throws when credits run out", async () => {
    await getBalance(profileId);
    await expect(debitCredits(profileId, 26, "export", "x")).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );
  });

  it("activates platform plan with coupon for subscribers", async () => {
    const order = await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "membro_plataforma",
      method: "pix",
      coupon: "PILOTOPODIUM",
    });
    expect(order.status).toBe("paid");
    const bal = await getBalance(profileId);
    expect(bal.plano).toBe("membro_plataforma");
    expect(bal.total).toBe(900);
    expect(bal.enrichAllowed).toBe(true);
    expect(bal.trialDaysLeft).toBeGreaterThanOrEqual(29);
    expect(bal.trialDaysLeft).toBeLessThanOrEqual(30);
    const me = await getBillingMe(profileId);
    expect(me.subscription?.status).toBe("trialing");
  });

  it("accepts PILOTOPODIUM when env still has the old PODIUM code", async () => {
    process.env.BILLING_PLATFORM_COUPON = "PODIUM";
    const order = await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "membro_plataforma",
      method: "pix",
      coupon: "pilotopodium",
    });
    expect(order.status).toBe("paid");
  });

  it("activates the platform plan when the coupon env is unset", async () => {
    delete process.env.BILLING_PLATFORM_COUPON;
    const order = await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "membro_plataforma",
      method: "pix",
      coupon: "PILOTOPODIUM",
    });
    expect(order.status).toBe("paid");
  });

  it("rejects platform coupon for non-subscribers", async () => {
    await expect(
      createCheckout({
        profileId,
        email: "intruso@example.com",
        nome: "Intruso",
        sku: "membro_plataforma",
        method: "pix",
        coupon: "PILOTOPODIUM",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects a second platform coupon after the trial was used", async () => {
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "membro_plataforma",
      method: "pix",
      coupon: "PILOTOPODIUM",
    });
    await expect(
      createCheckout({
        profileId,
        email: "piloto@mundopodium.com.br",
        nome: "Rômulo",
        sku: "membro_plataforma",
        method: "pix",
        coupon: "PILOTOPODIUM",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("locks qualify and redacts the grid after 31 days without payment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "membro_plataforma",
      method: "pix",
      coupon: "PILOTOPODIUM",
    });
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    const bal = await getBalance(profileId);
    expect(bal.plano).toBe("free");
    expect(bal.enrichAllowed).toBe(false);
    expect(bal.trialExpired).toBe(true);
    await expect(
      debitEnrich(profileId, ["12345678000190"], null),
    ).rejects.toThrow(/30 dias/);
    vi.useRealTimers();
  });

  it("extends access 30 days when a pack is paid after the trial ends", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "membro_plataforma",
      method: "pix",
      coupon: "PILOTOPODIUM",
    });
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "pack_100",
      method: "card_br",
    });
    const bal = await getBalance(profileId);
    expect(bal.enrichAllowed).toBe(true);
    expect(bal.plano).toBe("membro_plataforma");
    expect(bal.pack).toBe(100);
    expect(bal.trialExpired).toBe(false);
    const end = bal.periodEndsAt ? new Date(bal.periodEndsAt).getTime() : 0;
    expect(end).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    vi.useRealTimers();
  });

  it("turns a paid piloto checkout into an active monthly plan after the trial", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "membro_plataforma",
      method: "pix",
      coupon: "PILOTOPODIUM",
    });
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "piloto",
      method: "card_br",
    });
    const bal = await getBalance(profileId);
    expect(bal.plano).toBe("piloto");
    expect(bal.enrichAllowed).toBe(true);
    expect(bal.trialExpired).toBe(false);
    expect(bal.plan).toBe(900);
    const me = await getBillingMe(profileId);
    expect(me.subscription?.status).toBe("active");
    vi.useRealTimers();
  });

  it("applies a paid event matched by order id when payment id differs", async () => {
    const order = await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "pack_100",
      method: "boleto",
    });
    expect(order.status).toBe("pending");
    await handleNormalizedEvent(
      {
        provider: "mock",
        providerEventId: "evt-ref-1",
        type: "payment.paid",
        providerPaymentId: "pay_new_cycle",
        orderId: order.id,
      },
      {},
    );
    const bal = await getBalance(profileId);
    expect(bal.pack).toBe(100);
  });

  it("is idempotent on payment events", async () => {
    const order = await createCheckout({
      profileId,
      email: "piloto@mundopodium.com.br",
      nome: "Rômulo",
      sku: "pack_100",
      method: "boleto",
    });
    expect(order.status).toBe("pending");
    const event = {
      provider: "mock" as const,
      providerEventId: "evt-1",
      type: "payment.paid" as const,
      providerPaymentId: order.providerPaymentId ?? "",
    };
    await handleNormalizedEvent(event, {});
    await handleNormalizedEvent(event, {});
    const bal = await getBalance(profileId);
    expect(bal.pack).toBe(100);
  });
});
