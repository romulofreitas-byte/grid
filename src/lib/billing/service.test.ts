import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_USER_ID } from "@/lib/data/pg";
import { resetBillingMemory } from "@/lib/billing/memory-store";
import {
  applyPaymentPaid,
  createCheckout,
  debitCredits,
  debitEnrich,
  debitExport,
  getBalance,
  handleNormalizedEvent,
} from "@/lib/billing/service";
import { EnrichmentNotAllowedError, InsufficientCreditsError } from "@/lib/billing/types";

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
