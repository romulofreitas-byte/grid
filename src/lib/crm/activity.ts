import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { saoPauloDay } from "@/lib/call-stats";
import type {
  ActivitySignal,
  CrmActivity,
  CrmActivityKind,
} from "@/lib/crm/types";

export const CRM_ACTIVITY_KIND_LABELS: Record<CrmActivityKind, string> = {
  ligar: "Ligar",
  whatsapp: "WhatsApp",
  email: "E-mail",
  reuniao: "Reunião",
  followup: "Follow-up",
  proposta: "Proposta",
  nota: "Nota",
};

export const CRM_NEXT_ACTION_LABELS: Record<CrmActivityKind, string> = {
  ligar: "Próxima ligação",
  whatsapp: "Próximo WhatsApp",
  email: "Próximo e-mail",
  reuniao: "Próxima reunião",
  followup: "Próximo follow-up",
  proposta: "Próxima proposta",
  nota: "Próxima nota",
};

export function activitySignal(
  activity: Pick<CrmActivity, "due_at" | "status"> | null | undefined,
  now: Date = new Date(),
): ActivitySignal {
  if (!activity || activity.status !== "open") return "none";
  const due = new Date(activity.due_at);
  if (Number.isNaN(due.getTime())) return "none";
  if (due.getTime() < now.getTime()) return "overdue";
  if (saoPauloDay(due) === saoPauloDay(now)) return "today";
  return "scheduled";
}

export function formatNextAction(
  activity: Pick<CrmActivity, "kind" | "due_at" | "status"> | null | undefined,
  emptyLabel: string,
): string {
  if (!activity || activity.status !== "open") return emptyLabel;
  const due = new Date(activity.due_at);
  if (Number.isNaN(due.getTime())) return emptyLabel;
  const when = format(due, "EEE HH:mm", { locale: ptBR });
  return `${CRM_ACTIVITY_KIND_LABELS[activity.kind]} · ${when}`;
}

export function formatPlannedActivity(
  activity: Pick<CrmActivity, "kind" | "due_at" | "status"> | null | undefined,
): string | null {
  if (!activity || activity.status !== "open") return null;
  const due = new Date(activity.due_at);
  if (Number.isNaN(due.getTime())) return null;
  const when = format(due, "d/MMM HH:mm", { locale: ptBR });
  return `${CRM_ACTIVITY_KIND_LABELS[activity.kind]} · ${when}`;
}

export function toDatetimeLocal(iso: string, now = new Date()): string {
  const d = iso ? new Date(iso) : now;
  const date = Number.isNaN(d.getTime()) ? now : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function defaultNextDueLocal(now = new Date()): string {
  const next = new Date(now);
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return toDatetimeLocal(next.toISOString(), next);
}
