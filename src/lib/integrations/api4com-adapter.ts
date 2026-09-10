import type { IntegrationAdapter, OriginateInput, OutcomeEvent } from "./adapter";
import {
  asRecord,
  phoneToE164,
  pickCnpj,
  pickNumber,
  pickString,
  toLeadDialE164,
  vendorFetch,
  vendorHttpError,
} from "./voip-dial";

const BASE = "https://api.api4com.com/api/v1";
export const API4COM_GATEWAY = "grid-podium";
/** Public docs currently accept only `1.8` (`channel-answer` / `channel-hangup`). */
export const API4COM_WEBHOOK_VERSION = "1.8";

export const API4COM_HANGUP_NOTES: Record<string, string> = {
  NORMAL_CLEARING: "Atendida",
  USER_BUSY: "Ocupado",
  UNALLOCATED_NUMBER: "Número não encontrado",
  NUMBER_CHANGED: "Caixa postal",
  ORIGINATOR_CANCEL: "Cancelamento da ligação",
  ALLOTTED_TIMEOUT: "Tempo expirado",
};

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: token,
    "Content-Type": "application/json",
  };
}

export function api4comHangupNote(cause: string): string {
  return API4COM_HANGUP_NOTES[cause] ?? cause;
}

/** Official webhooks send `0` + DDD (`04833328530`). */
export function calledToE164(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return phoneToE164(trimmed);
  const digits = trimmed.replace(/\D/g, "");
  const national = digits.startsWith("0") ? digits.slice(1) : digits;
  return phoneToE164(national) ?? phoneToE164(trimmed);
}

export async function probeApi4com(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await vendorFetch(`${BASE}/users/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    return { ok: false, error: vendorHttpError(res.status, "Token recusado") };
  }
  return { ok: true };
}

function webhookPayload(webhookUrl: string) {
  return {
    webhookUrl,
    webhookVersion: API4COM_WEBHOOK_VERSION,
    webhookTypes: ["channel-answer", "channel-hangup"],
  };
}

export async function registerApi4comWebhook(
  token: string,
  webhookUrl: string,
): Promise<boolean> {
  const metadata = webhookPayload(webhookUrl);
  const dual = await vendorFetch(`${BASE}/integrations`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      gateway: API4COM_GATEWAY,
      webhook: true,
      webhookConstraint: {
        gateway: API4COM_GATEWAY,
        metadata: { gateway: API4COM_GATEWAY },
      },
      metadata,
    }),
  });
  if (dual.ok) return true;

  const fallback = await vendorFetch(`${BASE}/integrations`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      gateway: API4COM_GATEWAY,
      webhook: true,
      webhookConstraint: { gateway: API4COM_GATEWAY },
      metadata,
    }),
  });
  if (!fallback.ok) {
    console.warn(
      "api4com webhook register failed",
      fallback.status,
      fallback.text.slice(0, 240),
    );
  }
  return fallback.ok;
}

function tokenFrom(creds: Record<string, string>): string {
  const token = creds.token?.trim() ?? "";
  if (!token) throw new Error("Token da API4COM ausente");
  return token;
}

export async function hangupApi4com(
  token: string,
  dialerId: string,
): Promise<void> {
  const id = dialerId.trim();
  if (!id) throw new Error("Chamada sem identificador");
  const res = await vendorFetch(
    `${BASE}/calls/${encodeURIComponent(id)}/hangup`,
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
  if (res.ok || res.status === 404) return;
  throw new Error(vendorHttpError(res.status, "Não foi possível desligar", res.text));
}

export function parseApi4comInbound(rawBody: string): OutcomeEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
  const root = asRecord(json);
  const nested = asRecord(root?.data) ?? asRecord(root?.call) ?? root;
  const metadata =
    asRecord(nested?.metadata) ??
    asRecord(root?.metadata) ??
    asRecord(asRecord(nested?.webhookConstraint)?.metadata);
  const event =
    pickString(root, ["eventType", "event", "type", "webhookType"]) ??
    pickString(nested, ["eventType", "event", "type"]) ??
    "";
  if (/answer/i.test(event) && !/hangup|hang-up|complete/i.test(event)) {
    return null;
  }
  if (event && !/hangup|hang-up|complete|outcome/i.test(event)) {
    return null;
  }
  const cause =
    pickString(nested, ["hangup_cause", "hangupCause", "cause"]) ??
    pickString(root, ["hangup_cause", "hangupCause"]) ??
    "hangup";
  const to =
    pickString(nested, ["called", "to", "phone", "destination", "numero"]) ??
    pickString(root, ["called", "to", "phone"]);
  const recordingUrl =
    pickString(nested, ["recordUrl", "record_url", "recording_url"]) ??
    pickString(root, ["recordUrl", "record_url"]);
  const dealId =
    pickString(metadata, ["deal_id", "dealId"]) ??
    pickString(root, ["deal_id", "dealId"]);
  return {
    cnpj: pickCnpj(metadata),
    e164: calledToE164(to),
    disposition: cause,
    durationSec: pickNumber(nested, ["duration", "duration_sec", "billsec"]) ??
      pickNumber(root, ["duration", "duration_sec"]),
    externalId:
      pickString(nested, ["id", "call_id", "uuid"]) ??
      pickString(root, ["id", "call_id", "uuid"]),
    notes: api4comHangupNote(cause),
    recordingUrl,
    dealId,
  };
}

export function createApi4comAdapter(): IntegrationAdapter {
  return {
    kind: "voip",
    auth: "api_key",
    async originate(call: OriginateInput, ctx) {
      const creds = await ctx.decryptCredentials();
      const token = tokenFrom(creds);
      const extension = (call.from ?? ctx.callerId ?? "").trim();
      if (!extension) throw new Error("Informe o ramal");
      const phone = toLeadDialE164(call.toE164);
      if (!phone) {
        throw new Error("Número inválido. Precisa de DDD + telefone.");
      }
      const res = await vendorFetch(`${BASE}/dialer`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          extension,
          phone,
          metadata: {
            gateway: API4COM_GATEWAY,
            cnpj: call.cnpj || undefined,
            search_id: call.searchId,
            connection_id: ctx.connectionId,
            deal_id: call.dealId || undefined,
          },
        }),
      });
      if (!res.ok) {
        throw new Error(
          vendorHttpError(res.status, "Não foi possível ligar", res.text),
        );
      }
      const body = asRecord(res.json);
      return {
        accepted: true,
        externalId: pickString(body, ["id"]),
        message: pickString(body, ["message"]),
      };
    },
    async hangup(externalId, ctx) {
      const creds = await ctx.decryptCredentials();
      await hangupApi4com(tokenFrom(creds), externalId);
    },
    async parseInbound(_req, rawBody) {
      return parseApi4comInbound(rawBody);
    },
  };
}
