import type { ConnectionCtx, IntegrationAdapter, OriginateInput, OutcomeEvent } from "./adapter";
import {
  asRecord,
  phoneToE164,
  pickNumber,
  pickString,
  toDialE164,
  vendorFetch,
  vendorHttpError,
} from "./voip-dial";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function probeTelnyx(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await vendorFetch("https://api.telnyx.com/v2/balance", {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    return { ok: false, error: vendorHttpError(res.status, "Token recusado") };
  }
  return { ok: true };
}

function tokenFrom(creds: Record<string, string>): string {
  const token = creds.token?.trim() ?? "";
  if (!token) throw new Error("API key da Telnyx ausente");
  return token;
}

function appId(ctx: { config: Record<string, unknown> }): string {
  const id = typeof ctx.config.app_id === "string" ? ctx.config.app_id.trim() : "";
  if (!id) throw new Error("Informe o Call Control App ID");
  return id;
}

function fromNumber(ctx: { config: Record<string, unknown> }): string {
  const raw = typeof ctx.config.from_number === "string" ? ctx.config.from_number : "";
  const e164 = toDialE164(raw);
  if (!e164) throw new Error("Informe o número Telnyx (From) em E.164");
  return e164;
}

function encodeState(payload: Record<string, string | null>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeState(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    return asRecord(json);
  } catch {
    try {
      const json = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as unknown;
      return asRecord(json);
    } catch {
      return null;
    }
  }
}

function telnyxPayload(rawBody: string): {
  eventType: string;
  payload: Record<string, unknown> | null;
  state: Record<string, unknown> | null;
} {
  let json: unknown;
  try {
    json = JSON.parse(rawBody) as unknown;
  } catch {
    return { eventType: "", payload: null, state: null };
  }
  const root = asRecord(json);
  const data = asRecord(root?.data) ?? root;
  const payload = asRecord(data?.payload) ?? data;
  const eventType =
    pickString(data, ["event_type", "eventType"]) ??
    pickString(root, ["event_type"]) ??
    "";
  const state = decodeState(pickString(payload, ["client_state"]));
  return { eventType, payload, state };
}

export function parseTelnyxInbound(rawBody: string): OutcomeEvent | null {
  const { eventType, payload, state } = telnyxPayload(rawBody);
  if (!/hangup|hang-up|completed/i.test(eventType)) return null;
  const to =
    pickString(state, ["to"]) ??
    pickString(payload, ["to", "destination_number"]);
  const cnpj =
    typeof state?.cnpj === "string" && /^\d{14}$/.test(state.cnpj)
      ? state.cnpj
      : undefined;
  return {
    cnpj,
    e164: phoneToE164(to),
    disposition: pickString(payload, ["hangup_cause", "state"]) ?? eventType,
    durationSec: pickNumber(payload, ["duration_secs", "duration"]),
    externalId: pickString(payload, ["call_control_id", "call_leg_id"]),
  };
}

async function transferToLead(
  token: string,
  callControlId: string,
  to: string,
): Promise<void> {
  const res = await vendorFetch(
    `https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/transfer`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ to }),
    },
  );
  if (!res.ok) {
    throw new Error(
      vendorHttpError(res.status, "Telnyx não transferiu a ligação", res.text),
    );
  }
}

export function createTelnyxAdapter(): IntegrationAdapter {
  return {
    kind: "voip",
    auth: "api_key",
    async originate(call: OriginateInput, ctx) {
      const creds = await ctx.decryptCredentials();
      const token = tokenFrom(creds);
      const agent = toDialE164(call.from ?? ctx.callerId ?? "");
      if (!agent) throw new Error("Informe seu número com DDD para a Telnyx tocar");
      const inbound =
        typeof ctx.config.inbound_url === "string" ? ctx.config.inbound_url : "";
      const isTest = !call.cnpj;
      const res = await vendorFetch("https://api.telnyx.com/v2/calls", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          connection_id: appId(ctx),
          to: agent,
          from: fromNumber(ctx),
          webhook_url: inbound || undefined,
          client_state: encodeState({
            to: isTest ? "" : call.toE164,
            cnpj: call.cnpj || "",
            search_id: call.searchId,
          }),
        }),
      });
      if (!res.ok) {
        throw new Error(
          vendorHttpError(res.status, "Não foi possível ligar", res.text),
        );
      }
      const data = asRecord(asRecord(res.json)?.data);
      return {
        accepted: true,
        externalId: pickString(data, ["call_control_id"]),
      };
    },
    async parseInbound(_req, rawBody) {
      return parseTelnyxInbound(rawBody);
    },
    async ackInbound(rawBody: string, ctx: ConnectionCtx) {
      const { eventType, payload, state } = telnyxPayload(rawBody);
      if (!/answered/i.test(eventType) || /hangup/i.test(eventType)) return;
      const to = typeof state?.to === "string" ? state.to : "";
      const callControlId = pickString(payload, ["call_control_id"]);
      if (!to || !callControlId) return;
      const token = tokenFrom(await ctx.decryptCredentials());
      await transferToLead(token, callControlId, to);
    },
  };
}
