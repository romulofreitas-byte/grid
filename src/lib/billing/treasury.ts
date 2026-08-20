import { getBillingStore } from "@/lib/billing/service";
import { requireBillingWebhookSecret } from "@/lib/billing/webhook-guard";
import type { NormalizedPaymentEvent, TreasuryTransfer } from "@/lib/billing/types";
import { circleConfigured } from "@/lib/billing/providers/types";

function baseUrl(): string {
  return process.env.CIRCLE_API_BASE?.replace(/\/$/, "") ?? "https://api.circle.com";
}

function apiKey(): string {
  const key = process.env.CIRCLE_API_KEY?.trim();
  if (!key) throw new Error("CIRCLE_API_KEY ausente");
  return key;
}

type CirclePayout = {
  data?: { id?: string; status?: string };
  message?: string;
};

export async function submitCircleSweep(row: TreasuryTransfer): Promise<void> {
  const store = await getBillingStore();
  if (!circleConfigured()) {
    await store.updateTreasury(row.id, {
      status: "submitted",
      providerTransferId: `circle_skipped_${row.id}`,
      error: "CIRCLE_API_KEY ausente — tesouraria em modo log",
    });
    console.info("[treasury] Circle skip", {
      orderId: row.orderId,
      amountCents: row.amountCents,
    });
    return;
  }

  const pixAccountId = process.env.CIRCLE_PIX_ACCOUNT_ID?.trim();
  const amount = (row.amountCents / 100).toFixed(2);
  const res = await fetch(`${baseUrl()}/v1/businessAccount/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idempotencyKey: row.id,
      destination: {
        type: "pix",
        id: pixAccountId,
      },
      amount: { amount, currency: "BRL" },
      metadata: { orderId: row.orderId },
    }),
  });
  const json = (await res.json()) as CirclePayout;
  if (!res.ok || !json.data?.id) {
    await store.updateTreasury(row.id, {
      status: "failed",
      error: json.message ?? `Circle ${res.status}`,
    });
    return;
  }
  await store.updateTreasury(row.id, {
    status: "submitted",
    providerTransferId: json.data.id,
    error: null,
  });
}

export async function parseCircleWebhook(
  req: Request,
  rawBody: string,
): Promise<NormalizedPaymentEvent | null> {
  const token = process.env.CIRCLE_WEBHOOK_SECRET?.trim();
  requireBillingWebhookSecret("CIRCLE_WEBHOOK_SECRET", token);
  const header = req.headers.get("x-circle-signature") ?? req.headers.get("authorization");
  if (token && header && !header.includes(token)) {
    throw new Error("Webhook Circle não autorizado");
  }
  const body = JSON.parse(rawBody) as {
    id?: string;
    notificationId?: string;
    notificationType?: string;
    payout?: { id?: string; status?: string };
    transfer?: { id?: string; status?: string };
  };
  const transferId = body.payout?.id ?? body.transfer?.id;
  const status = (body.payout?.status ?? body.transfer?.status ?? "").toLowerCase();
  const eventId = body.notificationId ?? body.id ?? `circle-${transferId ?? crypto.randomUUID()}`;
  if (!transferId) return null;
  if (status === "complete" || status === "paid" || body.notificationType === "payouts.completed") {
      return {
        provider: "circle",
        providerEventId: eventId,
        type: "treasury.complete",
        providerTransferId: transferId,
      };
    }
    if (status === "failed" || body.notificationType === "payouts.failed") {
      return {
        provider: "circle",
        providerEventId: eventId,
        type: "treasury.failed",
        providerTransferId: transferId,
      };
  }
  return null;
}

export async function sweepPendingTreasury(): Promise<number> {
  const store = await getBillingStore();
  const pending = (await store.listPendingTreasury()).filter((t) => t.status === "pending");
  for (const row of pending) {
    await submitCircleSweep(row);
  }
  return pending.length;
}
