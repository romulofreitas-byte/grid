import { normalizePhoneBR } from "@/lib/phone";

const FETCH_MS = 15_000;

export function isRamal(raw: string): boolean {
  return /^\d{2,6}$/.test(raw.trim());
}

export function toDialE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  return normalizePhoneBR(trimmed)?.e164 ?? null;
}

export function brDigits(e164OrLocal: string): string {
  const trimmed = e164OrLocal.trim();
  if (isRamal(trimmed)) return trimmed;
  const e164 = toDialE164(trimmed) ?? trimmed;
  return e164.replace(/^\+55/, "").replace(/^\+/, "").replace(/\D/g, "");
}

export function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function vendorFetch(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; text: string; json: unknown }> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_MS),
  });
  const text = await res.text().catch(() => "");
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
  }
  return { ok: res.ok, status: res.status, text, json };
}

export function vendorHttpError(
  status: number,
  fallback: string,
  body?: string,
): string {
  if (status === 401 || status === 403) {
    return "Token recusado. Gere outro no painel do VoIP.";
  }
  if (status === 404) {
    return "Ramal ou número não encontrado no VoIP.";
  }
  const snippet = body?.replace(/\s+/g, " ").trim().slice(0, 160);
  return snippet ? `${fallback} (${status}: ${snippet})` : `${fallback} (${status})`;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function pickString(
  record: Record<string, unknown> | null,
  keys: string[],
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function pickNumber(
  record: Record<string, unknown> | null,
  keys: string[],
): number | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export function pickCnpj(record: Record<string, unknown> | null): string | undefined {
  const raw = pickString(record, ["cnpj"]);
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  return /^\d{14}$/.test(digits) ? digits : undefined;
}

export function phoneToE164(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (isRamal(raw)) return undefined;
  return toDialE164(raw) ?? undefined;
}
