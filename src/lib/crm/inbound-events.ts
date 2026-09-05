import type { ImportLeadInput } from "@/lib/crm/import";
import type {
  CrmInboundEvent,
  CrmInboundEventSnapshot,
  CrmInboundEventStatus,
} from "@/lib/crm/types";

export const INBOUND_EVENT_LIST_LIMIT = 20;
export const INBOUND_EVENT_KEEP = 50;

const SECRET_KEY = /token|authorization|password|secret|bearer|apikey|api_key/i;

export type PublicInboundEvent = {
  id: string;
  status: CrmInboundEventStatus;
  http_status: number;
  message: string;
  deal_id: string | null;
  snapshot: CrmInboundEventSnapshot;
  payload: Record<string, string> | null;
  created_at: string;
};

export type PublicInboundLastEvent = {
  status: CrmInboundEventStatus;
  message: string;
  created_at: string;
};

export function emptyInboundSnapshot(): CrmInboundEventSnapshot {
  return { company: "", name: "", phone: "", email: "", cnpj: "" };
}

export function snapshotInboundInput(
  row: ImportLeadInput | undefined,
): CrmInboundEventSnapshot {
  return {
    company: (row?.company ?? "").trim().slice(0, 120),
    name: (row?.name ?? "").trim().slice(0, 80),
    phone: (row?.phone ?? "").trim().slice(0, 40),
    email: (row?.email ?? "").trim().slice(0, 120),
    cnpj: (row?.cnpj ?? "").trim().slice(0, 32),
  };
}

export function clipInboundPayload(
  raw: unknown,
): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    const label = key.trim().slice(0, 80);
    if (!label) continue;
    const text =
      typeof value === "string"
        ? value.trim()
        : typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : "";
    if (!text) continue;
    out[label] = text.slice(0, 200);
    if (Object.keys(out).length >= 12) break;
  }
  return Object.keys(out).length ? out : null;
}

function parseSnapshot(raw: unknown): CrmInboundEventSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyInboundSnapshot();
  }
  const row = raw as Record<string, unknown>;
  return {
    company: String(row.company ?? "").slice(0, 120),
    name: String(row.name ?? "").slice(0, 80),
    phone: String(row.phone ?? "").slice(0, 40),
    email: String(row.email ?? "").slice(0, 120),
    cnpj: String(row.cnpj ?? "").slice(0, 32),
  };
}

function parsePayload(raw: unknown): Record<string, string> | null {
  return clipInboundPayload(raw);
}

export function parseInboundEventStatus(
  value: unknown,
): CrmInboundEventStatus | null {
  return value === "created" || value === "skipped" || value === "error"
    ? value
    : null;
}

export function toPublicInboundEvent(row: CrmInboundEvent): PublicInboundEvent {
  return {
    id: row.id,
    status: row.status,
    http_status: row.http_status,
    message: row.message,
    deal_id: row.deal_id,
    snapshot: row.snapshot,
    payload: row.payload,
    created_at: row.created_at,
  };
}

export function toPublicInboundLastEvent(
  row: CrmInboundEvent,
): PublicInboundLastEvent {
  return {
    status: row.status,
    message: row.message,
    created_at: row.created_at,
  };
}

export function inboundPayloadLine(
  payload: Record<string, string> | null,
): string {
  if (!payload) return "";
  return Object.entries(payload)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

export function inboundEventTone(
  status: CrmInboundEventStatus,
): "success" | "warning" | "neutral" {
  if (status === "created") return "success";
  if (status === "error") return "warning";
  return "neutral";
}

export function mapInboundEventRow(row: {
  id: unknown;
  endpoint_id: unknown;
  user_id: unknown;
  status: unknown;
  http_status: unknown;
  message: unknown;
  deal_id: unknown;
  snapshot: unknown;
  payload: unknown;
  created_at: unknown;
}): CrmInboundEvent | null {
  const status = parseInboundEventStatus(row.status);
  if (!status) return null;
  return {
    id: String(row.id),
    endpoint_id: String(row.endpoint_id),
    user_id: String(row.user_id),
    status,
    http_status: Number(row.http_status ?? 0),
    message: String(row.message ?? "").slice(0, 200),
    deal_id:
      row.deal_id == null || row.deal_id === "" ? null : String(row.deal_id),
    snapshot: parseSnapshot(row.snapshot),
    payload: parsePayload(row.payload),
    created_at: new Date(String(row.created_at)).toISOString(),
  };
}
