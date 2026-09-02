import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  CrmDealCard,
  CrmEvent,
  CrmEventKind,
  CrmOutcome,
} from "@/lib/crm/types";

export const CRM_EVENT_HISTORY_LIMIT = 50;

export const CRM_COMPOSER_KINDS = [
  "nota",
  "ligar",
  "whatsapp",
  "email",
  "reuniao",
  "followup",
  "proposta",
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
