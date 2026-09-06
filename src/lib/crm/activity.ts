import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { saoPauloDay } from "@/lib/call-stats";
import type {
  ActivitySignal,
  CrmActivity,
  CrmActivityKind,
  CrmDealCard,
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

export function sortOpenActivities(activities: CrmActivity[]): CrmActivity[] {
  return [...activities]
    .filter((row) => row.status === "open")
    .sort((a, b) => {
      const byDue = a.due_at.localeCompare(b.due_at);
      if (byDue !== 0) return byDue;
      return a.created_at.localeCompare(b.created_at);
    });
}

export function earliestOpenActivity(
  activities: CrmActivity[],
): CrmActivity | null {
  return sortOpenActivities(activities)[0] ?? null;
}

export function openActivitiesOf(deal: Pick<CrmDealCard, "next_activity" | "open_activities">): CrmActivity[] {
  if (deal.open_activities) return sortOpenActivities(deal.open_activities);
  return deal.next_activity ? [deal.next_activity] : [];
}

export function openLigarActivity(
  deal: Pick<CrmDealCard, "next_activity" | "open_activities">,
): CrmActivity | null {
  return (
    openActivitiesOf(deal).find((row) => row.kind === "ligar") ??
    (deal.next_activity?.kind === "ligar" ? deal.next_activity : null)
  );
}

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

function addDays(now: Date, days: number): Date {
  const next = new Date(now);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDueLabel(
  dueAt: string,
  now: Date = new Date(),
): string | null {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const time = format(due, "HH:mm", { locale: ptBR });
  const day = format(due, "d/MMM", { locale: ptBR });
  if (saoPauloDay(due) === saoPauloDay(now)) return `Hoje ${time}`;
  if (saoPauloDay(due) === saoPauloDay(addDays(now, 1))) return `Amanhã ${time}`;
  return `${day} ${time}`;
}

export function formatNextAction(
  activity: Pick<CrmActivity, "kind" | "due_at" | "status"> | null | undefined,
  emptyLabel: string,
  now: Date = new Date(),
): string {
  if (!activity || activity.status !== "open") return emptyLabel;
  const when = formatDueLabel(activity.due_at, now);
  if (!when) return emptyLabel;
  return `${CRM_ACTIVITY_KIND_LABELS[activity.kind]} · ${when}`;
}

export function formatPlannedActivity(
  activity: Pick<CrmActivity, "kind" | "due_at" | "status"> | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!activity || activity.status !== "open") return null;
  const when = formatDueLabel(activity.due_at, now);
  if (!when) return null;
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
