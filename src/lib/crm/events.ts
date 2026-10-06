import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  CrmDealCard,
  CrmEvent,
  CrmEventKind,
  CrmOutcome,
} from "@/lib/crm/types";

export const CRM_EVENT_HISTORY_LIMIT = 50;

export const CRM_CALL_RECORDING_LABEL = "Gravação da ligação";

export const CRM_CALL_ID_MAX = 120;

/** How often the open card asks for the hangup recording. */
export const CRM_RECORDING_POLL_MS = 4_000;

/** Stop waiting if API4COM never sends the file. */
export const CRM_RECORDING_WATCH_MS = 2 * 60 * 1000;

export function normalizeCallId(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed || trimmed.length > CRM_CALL_ID_MAX) return null;
  return trimmed;
}

export function readCrmEventMeta(value: unknown): CrmEvent["meta"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const meta: CrmEvent["meta"] = {};
  if (typeof raw.phone === "string" && raw.phone.trim()) {
    meta.phone = raw.phone;
  }
  if (raw.outcome === "open" || raw.outcome === "won" || raw.outcome === "lost") {
    meta.outcome = raw.outcome;
  }
  if (typeof raw.record_url === "string" && raw.record_url.startsWith("https://")) {
    meta.record_url = raw.record_url;
  }
  const callId = normalizeCallId(
    typeof raw.call_id === "string" ? raw.call_id : null,
  );
  if (callId) meta.call_id = callId;
  return meta;
}

export function callRecordingReady(events: CrmEvent[], callId: string): boolean {
  const id = normalizeCallId(callId);
  if (!id) return false;
  return events.some(
    (event) =>
      event.kind === "ligar" &&
      event.meta.call_id === id &&
      Boolean(event.meta.record_url),
  );
}

export const CRM_COMPOSER_KINDS = [
  "nota",
  "ligar",
  "whatsapp",
  "followup",
  "reuniao",
  "proposta",
  "email",
] as const;

export type CrmComposerKind = (typeof CRM_COMPOSER_KINDS)[number];

export const CRM_EVENT_KIND_LABELS: Record<CrmEventKind, string> = {
  ligar: "Ligação feita",
  whatsapp: "WhatsApp enviado",
  email: "E-mail enviado",
  reuniao: "Reunião registrada",
  followup: "Follow-up registrado",
  proposta: "Proposta registrada",
  nota: "Nota",
  outcome: "Status",
};

export const CRM_OUTCOME_LABELS: Record<CrmOutcome, string> = {
  open: "Em andamento",
  won: "Ganho",
  lost: "Perdido",
};

export function eventTitle(event: Pick<CrmEvent, "kind" | "meta">): string {
  if (event.kind === "outcome") {
    const outcome = event.meta.outcome;
    if (outcome === "won") return "Marcado como ganho";
    if (outcome === "lost") return "Marcado como perdido";
    if (outcome === "open") return "Voltou para em andamento";
  }
  return CRM_EVENT_KIND_LABELS[event.kind];
}

export function formatEventWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d/MMM HH:mm", { locale: ptBR });
}

export function visibleKanbanDeals(
  deals: CrmDealCard[],
  showClosed: boolean,
): CrmDealCard[] {
  if (showClosed) return deals;
  return deals.filter((deal) => deal.outcome === "open");
}

export function closedDealCount(deals: CrmDealCard[]): number {
  return deals.filter((deal) => deal.outcome !== "open").length;
}
