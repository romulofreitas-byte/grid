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

const BASES = [
  "https://voice-api.zenvia.com",
  "https://api.totalvoice.com.br",
] as const;

function authHeaders(token: string): HeadersInit {
  return {
    "Access-Token": token,
    "Content-Type": "application/json",
  };
}

async function zenviaFetch(
  token: string,
  path: string,
  init: RequestInit,
  preferredBase?: string,
): Promise<{ ok: boolean; status: number; text: string; json: unknown; base: string }> {
  const order = preferredBase
    ? [preferredBase, ...BASES.filter((b) => b !== preferredBase)]
    : [...BASES];
  let last = {
    ok: false,
    status: 0,
    text: "",
    json: null as unknown,
    base: order[0]!,
  };
  for (const base of order) {
    const res = await vendorFetch(`${base}${path}`, {
      ...init,
      headers: { ...authHeaders(token), ...init.headers },
    });
    last = { ...res, base };
    if (res.ok || (res.status !== 404 && res.status !== 0)) return last;
  }
  return last;
}

export async function probeZenvia(
  token: string,
): Promise<{ ok: true; base: string } | { ok: false; error: string }> {
  const res = await zenviaFetch(token, "/conta", { method: "GET" });
  if (!res.ok) {
    return { ok: false, error: vendorHttpError(res.status, "Token recusado") };
  }
  return { ok: true, base: res.base };
}

function tokenFrom(creds: Record<string, string>): string {
  const token = creds.token?.trim() ?? "";
  if (!token) throw new Error("Token da Zenvia ausente");
  return token;
}

export function parseZenviaInbound(rawBody: string): OutcomeEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
  const root = asRecord(json);
  const data = asRecord(root?.data) ?? root;
  const status =
    pickString(data, ["status", "status_chamada", "tipo"]) ?? "ligando";
  const phone =
    pickString(data, ["telefone", "numero_destino", "to", "phone"]) ??
    pickString(root, ["telefone"]);
  return {
    cnpj: pickCnpj(data) ?? pickCnpj(asRecord(data?.tags)),
    e164: phoneToE164(phone),
    disposition: status,
    durationSec: pickNumber(data, ["duracao", "duration", "duration_sec"]),
    externalId: pickString(data, ["id", "chamada_id"]),
  };
}

export function createZenviaAdapter(): IntegrationAdapter {
  return {
    kind: "voip",
    auth: "api_key",
    async originate(call: OriginateInput, ctx) {
      const creds = await ctx.decryptCredentials();
      const token = tokenFrom(creds);
      const ramal = (call.from ?? ctx.callerId ?? "").trim();
      if (!ramal) throw new Error("Informe o ramal");
      const destino = isRamal(call.toE164)
        ? call.toE164.trim()
        : brDigits(call.toE164);
      const base =
        typeof ctx.config.api_base === "string" ? ctx.config.api_base : undefined;
      const res = await zenviaFetch(
        token,
        "/chamada",
        {
          method: "POST",
          body: JSON.stringify({
            numero_destino: destino,
            ramal,
            tags: call.cnpj || undefined,
          }),
        },
        base,
      );
      if (!res.ok) {
        throw new Error(
          vendorHttpError(res.status, "Não foi possível ligar", res.text),
        );
      }
      const body = asRecord(res.json);
      const nested = asRecord(body?.dados) ?? body;
      return {
        accepted: true,
        externalId: pickString(nested, ["id"]) ?? pickString(body, ["id"]),
      };
    },
    async parseInbound(_req, rawBody) {
      return parseZenviaInbound(rawBody);
    },
  };
}
