import type { IntegrationAdapter, OriginateInput } from "./adapter";
import { signGridWebhook } from "./hmac";
import type { LeadOutbound } from "./schema";

const FETCH_MS = 15_000;

async function postSigned(
  url: string,
  secret: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const body = JSON.stringify(payload);
  const signed = signGridWebhook(secret, body, undefined, event);
  const res = await fetch(url, {
    method: "POST",
    headers: signed.headers,
    body,
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`webhook HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }
}

export function createWebhookAdapter(): IntegrationAdapter {
  return {
    kind: "webhook",
    auth: "api_key",
    async pushList(leads: LeadOutbound[], ctx) {
      const creds = await ctx.decryptCredentials();
      const url = String(ctx.config.webhook_url ?? creds.webhook_url ?? "");
      const secret = creds.hmac_secret;
      if (!url || !secret) throw new Error("webhook connection is incomplete");
      const searchId =
        typeof ctx.config.search_id === "string" ? ctx.config.search_id : null;
      await postSigned(url, secret, "list.exported", {
        event: "list.exported",
        occurred_at: new Date().toISOString(),
        connection_id: ctx.connectionId,
        search_id: searchId,
        leads,
      });
      return { accepted: leads.length, failed: 0, errors: [] };
    },
    async originate(call: OriginateInput, ctx) {
      const creds = await ctx.decryptCredentials();
      const url = String(ctx.config.webhook_url ?? creds.webhook_url ?? "");
      const secret = creds.hmac_secret;
      if (!url || !secret) throw new Error("webhook connection is incomplete");
      await postSigned(url, secret, "call.originated", {
        event: "call.originated",
        occurred_at: new Date().toISOString(),
        connection_id: ctx.connectionId,
        search_id: call.searchId,
        cnpj: call.cnpj,
        to: call.toE164,
        from: call.from ?? ctx.callerId ?? null,
      });
      return { accepted: true };
    },
  };
}
