import type { IntegrationAdapter, OriginateInput, OutcomeEvent } from "./adapter";
import {
  asRecord,
  brDigits,
  isRamal,
  phoneToE164,
  pickCnpj,
  pickNumber,
  pickString,
  vendorFetch,
  vendorHttpError,
} from "./voip-dial";

const BASE = "https://api.api4com.com/api/v1";
export const API4COM_GATEWAY = "grid-podium";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: token,
    "Content-Type": "application/json",
  };
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

export async function registerApi4comWebhook(
  token: string,
  webhookUrl: string,
): Promise<boolean> {
  const res = await vendorFetch(`${BASE}/integrations`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      gateway: API4COM_GATEWAY,
      webhook: true,
      webhookConstraint: { gateway: API4COM_GATEWAY },
      metadata: {
        webhookUrl,
        webhookVersion: "v1.4",
        webhookTypes: ["channel-answer", "channel-hangup"],
      },
    }),
  });
  return res.ok;
}

function tokenFrom(creds: Record<string, string>): string {
  const token = creds.token?.trim() ?? "";
  if (!token) throw new Error("Token da API4COM ausente");
  return token;
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
    pickString(root, ["event", "type", "webhookType"]) ??
    pickString(nested, ["event", "type"]) ??
    "call.outcome";
  if (/answer/i.test(event) && !/hangup|hang-up|complete/i.test(event)) {
    return {
      cnpj: pickCnpj(metadata),
      e164: phoneToE164(
        pickString(nested, ["to", "phone", "destination", "numero"]) ??
          pickString(root, ["to", "phone"]),
      ),
      disposition: "answered",
      durationSec: pickNumber(nested, ["duration", "duration_sec", "billsec"]),
      externalId: pickString(nested, ["id", "call_id", "uuid"]),
    };
  }
  const cause =
    pickString(nested, ["hangup_cause", "hangupCause", "cause"]) ??
    pickString(root, ["hangup_cause", "hangupCause"]) ??
    "hangup";
  const to =
    pickString(nested, ["to", "phone", "destination", "numero"]) ??
    pickString(root, ["to", "phone"]);
  return {
    cnpj: pickCnpj(metadata),
    e164: phoneToE164(to),
    disposition: cause,
    durationSec: pickNumber(nested, ["duration", "duration_sec", "billsec"]),
    externalId: pickString(nested, ["id", "call_id", "uuid"]),
    notes: cause,
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
      const phone = isRamal(call.toE164)
        ? call.toE164.trim()
        : call.toE164.startsWith("+")
          ? call.toE164
          : `+${brDigits(call.toE164)}`;
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
    async parseInbound(_req, rawBody) {
      return parseApi4comInbound(rawBody);
    },
  };
}
