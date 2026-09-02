"use client";

import {
  Calendar,
  Check,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Repeat,
  StickyNote,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CrmDateTimePicker } from "@/components/crm/CrmDateTimePicker";
import { CrmStageChevronBar } from "@/components/crm/CrmStageChevronBar";
import { COPY } from "@/lib/copy";
import { leadHrefForCnpj } from "@/lib/back";
import {
  activitySignal,
  CRM_NEXT_ACTION_LABELS,
  defaultNextDueLocal,
  formatPlannedActivity,
  fromDatetimeLocal,
  toDatetimeLocal,
} from "@/lib/crm/activity";
import {
  buildCrmBriefing,
  type CrmBriefing,
} from "@/lib/crm/briefing";
import { CRM_FIELD_LIGHT, CRM_LABEL_LIGHT, crmFetch } from "@/lib/crm/client";
import {
  getCachedDealBriefing,
  getCachedDealEvents,
  loadDealBriefing,
  loadDealEvents,
  setCachedDealEvents,
} from "@/lib/crm/deal-extras-cache";
import {
  firstDialablePhone,
  telHrefFromPhone,
  uniquePhones,
  waHrefFromPhone,
} from "@/lib/crm/dial";
import {
  CRM_COMPOSER_KINDS,
  eventTitle,
  formatEventWhen,
  type CrmComposerKind,
} from "@/lib/crm/events";
import {
  emptyPerson,
  peopleFromDeal,
  sanitizePeople,
  sanitizeSecretaries,
} from "@/lib/crm/people";
import type {
  CrmActivityKind,
  CrmDealCard,
  CrmEvent,
  CrmOutcome,
  CrmPerson,
  CrmStage,
} from "@/lib/crm/types";
import { normalizePhoneBR, phonesMatch } from "@/lib/phone";
import { cn } from "@/lib/utils";

const COMPOSER_ICONS: Record<CrmComposerKind, typeof Phone> = {
  nota: StickyNote,
  ligar: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  reuniao: Calendar,
  followup: Repeat,
  proposta: FileText,
};

const DEAL_MODAL_EASE = [0.16, 1, 0.3, 1] as const;

const COMPOSER_TAB_LABELS: Record<CrmComposerKind, string> = {
  nota: "Nota",
  ligar: "Ligar",
  whatsapp: "WhatsApp",
  email: "E-mail",
  reuniao: "Reunião",
  followup: "Follow-up",
  proposta: "Proposta",
};

function formatPhoneDisplay(raw: string): string {
  const parsed = normalizePhoneBR(raw);
  if (!parsed || parsed.display.length > 24) return raw;
  return parsed.display;
}

function cleanedPhones(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function launchHref(href: string) {
  if (href.startsWith("tel:")) {
    window.location.href = href;
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}

function personPlaceholder(field: "name" | "phone" | "email"): string {
  if (field === "name") return "Adicionar";
  if (field === "phone") return COPY.crmPersonPhone;
  return COPY.crmPersonEmail;
}

export function CrmDealModal({
  deal,
  stages,
  onClose,
  onChange,
  onDeleted,
  onMoveStage,
}: {
  deal: CrmDealCard;
  stages: CrmStage[];
  onClose: () => void;
  onChange: (deal: CrmDealCard) => void;
  onDeleted: (dealId: string) => void;
  onMoveStage: (stageId: string) => void;
}) {
  const [people, setPeople] = useState(() => peopleFromDeal(deal));
  const [secretaries, setSecretaries] = useState(() =>
    deal.secretaries.length > 0 ? deal.secretaries : [""],
  );
  const [phones, setPhones] = useState(
    deal.phones.length > 0 ? deal.phones : [""],
  );
  const [briefing, setBriefing] = useState<CrmBriefing>(
    () => getCachedDealBriefing(deal.id) ?? buildCrmBriefing(deal, null),
  );
  const [composerKind, setComposerKind] = useState<CrmComposerKind>("ligar");
  const [body, setBody] = useState("");
  const [events, setEvents] = useState<CrmEvent[]>(
    () => getCachedDealEvents(deal.id) ?? [],
  );
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dueLocal, setDueLocal] = useState(
    deal.next_activity
      ? toDatetimeLocal(deal.next_activity.due_at)
      : defaultNextDueLocal(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const presence = {
    duration: reduce ? 0 : 0.2,
    ease: DEAL_MODAL_EASE,
  };
  const phonesRef = useRef(phones);
  phonesRef.current = phones;
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const secretariesRef = useRef(secretaries);
  secretariesRef.current = secretaries;
  const companyPhoneRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPeople(peopleFromDeal(deal));
  }, [deal]);

  useEffect(() => {
    setPhones(deal.phones.length > 0 ? deal.phones : [""]);
    setSecretaries(deal.secretaries.length > 0 ? deal.secretaries : [""]);
    setBody("");
    setComposerKind(deal.next_activity?.kind ?? "ligar");
    setDueLocal(
      deal.next_activity
        ? toDatetimeLocal(deal.next_activity.due_at)
        : defaultNextDueLocal(),
    );
    setExpandedEventId(null);
    setDrafts({});
  }, [deal.id]);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedDealEvents(deal.id);
    if (cached) {
      setEvents(cached);
      return;
    }
    void loadDealEvents(deal.id, async () => {
      const res = await crmFetch<{ events: CrmEvent[] }>(
        `/api/crm/deals/${deal.id}/events`,
      );
      return res.events;
    })
      .then((events) => {
        if (!cancelled) setEvents(events);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Não carregou o histórico.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedDealBriefing(deal.id);
    if (cached) {
      setBriefing(cached);
      return;
    }
    setBriefing(buildCrmBriefing(deal, null));
    void loadDealBriefing(deal.id, async () => {
      const res = await crmFetch<{ briefing: CrmBriefing }>(
        `/api/crm/deals/${deal.id}/briefing`,
      );
      return res.briefing;
    })
      .then((next) => {
        if (!cancelled) setBriefing(next);
      })
      .catch(() => {
        if (!cancelled) setBriefing(buildCrmBriefing(deal, null));
      });
    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function patch(payload: Record<string, unknown>) {
    const res = await crmFetch<{ deal: CrmDealCard }>(
      `/api/crm/deals/${deal.id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    onChange(res.deal);
  }

  function queuePhones(next: string[]) {
    phonesRef.current = next;
    setPhones(next);
  }

  async function persistPhones(next: string[]) {
    try {
      await patch({ phones: cleanedPhones(next).map(formatPhoneDisplay) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou o telefone.");
    }
  }

  function flushPhones(next = phonesRef.current) {
    const formatted = next.map((value) =>
      value.trim() ? formatPhoneDisplay(value) : value,
    );
    phonesRef.current = formatted.length > 0 ? formatted : [""];
    setPhones(phonesRef.current);
    void persistPhones(formatted);
  }

  function queuePeople(next: CrmPerson[]) {
    peopleRef.current = next;
    setPeople(next);
  }

  async function persistPeople(next: CrmPerson[]) {
    try {
      await patch({ people: sanitizePeople(next) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou o contato.");
    }
  }

  function flushPeople(next = peopleRef.current) {
    const ready = sanitizePeople(next);
    peopleRef.current = ready;
    setPeople(ready);
    void persistPeople(ready);
  }

  function queueSecretaries(next: string[]) {
    secretariesRef.current = next.length > 0 ? next : [""];
    setSecretaries(secretariesRef.current);
  }

  async function persistSecretaries(next: string[]) {
    try {
      await patch({ secretaries: sanitizeSecretaries(next) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou a secretária.");
    }
  }

  function flushSecretaries(next = secretariesRef.current) {
    void persistSecretaries(next);
  }

  function prependEvent(event: CrmEvent) {
    setEvents((current) => {
      const next = [event, ...current.filter((row) => row.id !== event.id)];
      setCachedDealEvents(deal.id, next);
      return next;
    });
  }

  function updateEvent(event: CrmEvent) {
    setEvents((current) => {
      const next = current.map((row) => (row.id === event.id ? event : row));
      setCachedDealEvents(deal.id, next);
      return next;
    });
  }

  function dialTargets(): string[] {
    return uniquePhones([
      ...cleanedPhones(phonesRef.current),
      ...peopleRef.current.flatMap((person) =>
        person.phone.trim() ? [person.phone] : [],
      ),
    ]);
  }

  function dialPhone(raw: string | null) {
    if (!raw) {
      companyPhoneRef.current?.focus();
      setError(COPY.crmNoPhone);
      return false;
    }
    const href = telHrefFromPhone(raw);
    if (!href) {
      setError(COPY.crmNoPhone);
      return false;
    }
    launchHref(href);
    return true;
  }

  function startCall(phone?: string) {
    setError(null);
    const target = phone ?? firstDialablePhone(dialTargets());
    if (!dialPhone(target ?? null) && !target) {
      companyPhoneRef.current?.focus();
    }
  }

  function startWhatsapp() {
    setError(null);
    const target = firstDialablePhone(dialTargets());
    if (target) {
      const href = waHrefFromPhone(target);
      if (href) launchHref(href);
      return;
    }
    setError(COPY.crmNoPhone);
    companyPhoneRef.current?.focus();
  }

  function nextPayload(): { kind: CrmActivityKind; dueAt: string } | null {
    const dueAt = fromDatetimeLocal(dueLocal || defaultNextDueLocal());
    if (!dueAt) return null;
    return { kind: composerKind, dueAt };
  }

  async function saveComposer() {
    const next = nextPayload();
    if (!next) {
      setError("Escolha a ação e o horário.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const scheduled = await crmFetch<{ deal: CrmDealCard }>(
        `/api/crm/deals/${deal.id}/schedule`,
        { method: "POST", body: JSON.stringify(next) },
      );
      onChange(scheduled.deal);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não agendou.");
    } finally {
      setSaving(false);
    }
  }

  async function completePlanned() {
    setSaving(true);
    setError(null);
    try {
      const res = await crmFetch<{ deal: CrmDealCard; event: CrmEvent }>(
        `/api/crm/deals/${deal.id}/complete`,
        { method: "POST" },
      );
      onChange(res.deal);
      prependEvent(res.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não concluiu.");
    } finally {
      setSaving(false);
    }
  }

  async function saveHistory(eventId: string) {
    const nextBody = drafts[eventId];
    if (nextBody === undefined) return;
    setSaving(true);
    setError(null);
    try {
      const res = await crmFetch<{ deal: CrmDealCard; event: CrmEvent }>(
        `/api/crm/deals/${deal.id}/events/${eventId}`,
        { method: "PATCH", body: JSON.stringify({ body: nextBody }) },
      );
      onChange(res.deal);
      updateEvent(res.event);
      setExpandedEventId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou o texto.");
    } finally {
      setSaving(false);
    }
  }

  async function setOutcome(outcome: CrmOutcome) {
    setSaving(true);
    setError(null);
    try {
      const res = await crmFetch<{ deal: CrmDealCard; event: CrmEvent }>(
        `/api/crm/deals/${deal.id}/outcome`,
        { method: "POST", body: JSON.stringify({ outcome }) },
      );
      onChange(res.deal);
      prependEvent(res.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não atualizou o status.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await crmFetch(`/api/crm/deals/${deal.id}`, { method: "DELETE" });
      onDeleted(deal.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não excluiu.");
      setSaving(false);
    }
  }

  function selectTab(id: CrmComposerKind) {
    setComposerKind(id);
  }

  function updatePerson(index: number, field: keyof CrmPerson, value: string) {
    const next = peopleRef.current.map((person, i) =>
      i === index ? { ...person, [field]: value } : person,
    );
    queuePeople(next);
  }

  function selectCompanyPhone(value: string) {
    const rest = cleanedPhones(phonesRef.current).filter(
      (row) => row !== value && !phonesMatch(row, value),
    );
    const next = [value, ...rest];
    queuePhones(next);
    void persistPhones(next);
  }

  const outcomes: CrmOutcome[] = ["lost", "open", "won"];
  const phoneOptions = uniquePhones([
    ...cleanedPhones(phones),
    ...briefing.phones,
  ]);
  const companyPhone = phones[0]?.trim() || phoneOptions[0] || "";
  const headerPhone =
    firstDialablePhone([companyPhone, ...dialTargets()]) ??
    briefing.phone ??
    null;
  const headerContact = people[0]?.name.trim() || briefing.contact;
  const plannedTitle = formatPlannedActivity(deal.next_activity);
  const plannedSignal = activitySignal(deal.next_activity);
  const extraPeople = people.slice(1);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={presence}
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-deal-title"
        className="relative flex h-[min(92vh,56rem)] w-[min(96vw,88rem)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-900 shadow-2xl"
        initial={reduce ? false : { scale: 0.98 }}
        animate={{ scale: 1 }}
        exit={reduce ? undefined : { scale: 0.98 }}
        transition={presence}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                id="crm-deal-title"
                className="truncate text-sm font-semibold leading-tight"
              >
                {deal.company_name}
              </h2>
              {deal.cnpj ? (
                <Link
                  href={leadHrefForCnpj(deal.cnpj, deal.meta.searchId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-amber-700 hover:underline"
                >
                  {COPY.crmOpenFicha}
                </Link>
              ) : null}
              {briefing.municipio ? (
                <span className="text-[10px] text-zinc-400">
                  {briefing.municipio}
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {headerPhone ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700">
                  <Phone className="h-3 w-3" />
                  {formatPhoneDisplay(headerPhone)}
                </span>
              ) : (
                <span className="text-[11px] text-zinc-400">{COPY.crmNoPhone}</span>
              )}
              {headerContact ? (
                <span className="text-xs text-zinc-600">{headerContact}</span>
              ) : null}
              {deal.cnpj
                ? briefing.badges.map((badge) => (
                    <span
                      key={badge.id}
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        badge.found
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500",
                      )}
                    >
                      {badge.label} · {badge.found ? "ok" : "falta"}
                    </span>
                  ))
                : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex rounded-md border border-zinc-200 p-0.5">
              {outcomes.map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={saving}
                  onClick={() => void setOutcome(id)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium transition",
                    deal.outcome === id
                      ? id === "won"
                        ? "text-emerald-700"
                        : id === "lost"
                          ? "text-red-700"
                          : "text-amber-800"
                      : "text-zinc-400 hover:text-zinc-700",
                  )}
                >
                  {id === "open"
                    ? COPY.crmOutcomeOpen
                    : id === "won"
                      ? COPY.crmOutcomeWon
                      : COPY.crmOutcomeLost}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <CrmStageChevronBar
          stages={stages}
          activeId={deal.stage_id}
          onSelect={onMoveStage}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:flex-row md:p-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 overflow-hidden">
            <div className="flex flex-wrap gap-1">
              {CRM_COMPOSER_KINDS.map((id) => {
                const Icon = COMPOSER_ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTab(id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition",
                      composerKind === id
                        ? "border-amber-400 text-amber-800"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {COMPOSER_TAB_LABELS[id]}
                  </button>
                );
              })}
            </div>
            <textarea
              ref={textareaRef}
              className={cn(CRM_FIELD_LIGHT, "min-h-16 resize-y")}
              value={body}
              autoComplete="off"
              onChange={(event) => setBody(event.target.value)}
              placeholder={COPY.crmComposerPlaceholder}
            />
            <div className="rounded-md border border-zinc-200 bg-white p-2.5">
              <p className={CRM_LABEL_LIGHT}>
                {CRM_NEXT_ACTION_LABELS[composerKind]}
              </p>
              <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3">
                <CrmDateTimePicker
                  variant="light"
                  value={dueLocal || defaultNextDueLocal()}
                  onChange={setDueLocal}
                />
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {composerKind === "whatsapp" ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => startWhatsapp()}
                      className="inline-flex items-center gap-1 rounded-md bg-podium-yellow px-2.5 py-1 text-[11px] font-medium text-podium-navy hover:brightness-110 disabled:opacity-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {COPY.crmWhatsappNow}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveComposer()}
                    className="rounded-md bg-podium-yellow px-2.5 py-1 text-[11px] font-medium text-podium-navy hover:brightness-110 disabled:opacity-50"
                  >
                    {COPY.crmLogCall}
                  </button>
                </div>
              </div>
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <p className={CRM_LABEL_LIGHT}>{COPY.crmHistoryTitle}</p>
              <div className="mt-1.5 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {plannedTitle ? (
                  <article
                    className={cn(
                      "rounded-md border px-2.5 py-2",
                      plannedSignal === "overdue"
                        ? "border-red-200 bg-red-50"
                        : plannedSignal === "today"
                          ? "border-amber-200 bg-amber-50"
                          : "border-zinc-200 bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-zinc-800">
                        {(() => {
                          const Icon =
                            COMPOSER_ICONS[deal.next_activity?.kind ?? "nota"];
                          return <Icon className="h-3 w-3 shrink-0 text-amber-600" />;
                        })()}
                        {plannedTitle}
                      </p>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <p
                          className={cn(
                            "text-[10px] font-medium uppercase tracking-wide",
                            plannedSignal === "overdue"
                              ? "text-red-600"
                              : plannedSignal === "today"
                                ? "text-amber-700"
                                : "text-zinc-400",
                          )}
                        >
                          {plannedSignal === "overdue"
                            ? COPY.crmHistoryTodoOverdue
                            : plannedSignal === "today"
                              ? COPY.crmHistoryTodoToday
                              : COPY.crmHistoryTodo}
                        </p>
                        {deal.next_activity?.created_at ? (
                          <p className="text-[10px] text-zinc-400">
                            {COPY.crmCreatedAt}{" "}
                            {formatEventWhen(deal.next_activity.created_at)}
                          </p>
                        ) : null}
                        <label className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-700">
                          <input
                            type="checkbox"
                            disabled={saving}
                            aria-label={COPY.crmMarkDone}
                            onChange={(event) => {
                              event.currentTarget.checked = false;
                              void completePlanned();
                            }}
                            className="h-3 w-3 rounded-sm border-zinc-300 text-amber-700 accent-amber-600 disabled:opacity-50"
                          />
                          {COPY.crmMarkDone}
                        </label>
                      </div>
                    </div>
                  </article>
                ) : null}
                {events.length === 0 && !plannedTitle ? (
                  <p className="text-xs text-zinc-400">{COPY.crmHistoryEmpty}</p>
                ) : (
                  events.map((event) => {
                    const Icon =
                      COMPOSER_ICONS[event.kind as CrmComposerKind] ?? StickyNote;
                    const expanded = expandedEventId === event.id;
                    const draft = drafts[event.id] ?? event.body;
                    return (
                      <article
                        key={event.id}
                        className="rounded-md border border-zinc-200 bg-white px-2.5 py-2"
                      >
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-2 text-left"
                          onClick={() => {
                            setExpandedEventId(expanded ? null : event.id);
                            setDrafts((current) => ({
                              ...current,
                              [event.id]: event.body,
                            }));
                          }}
                        >
                          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-800">
                            <Icon className="h-3 w-3 text-amber-600" />
                            {eventTitle(event)}
                          </p>
                          <p className="shrink-0 text-[10px] text-zinc-400">
                            {COPY.crmCreatedAt} {formatEventWhen(event.created_at)}
                          </p>
                        </button>
                        {expanded ? (
                          <div className="mt-2">
                            <textarea
                              className={cn(CRM_FIELD_LIGHT, "min-h-16 resize-y")}
                              value={draft}
                              onChange={(row) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [event.id]: row.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void saveHistory(event.id)}
                              className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" />
                              {COPY.crmSaveHistory}
                            </button>
                          </div>
                        ) : event.body ? (
                          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-zinc-600">
                            {event.body}
                          </p>
                        ) : null}
                        {event.meta.phone ? (
                          <p className="mt-1 font-mono text-[10px] text-zinc-400">
                            {event.meta.phone}
                          </p>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto md:w-[17rem]">
            <div className="rounded-md border border-zinc-200 bg-white p-2.5">
              <p className={CRM_LABEL_LIGHT}>{COPY.crmContactLabel}</p>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {(["name", "phone", "email"] as const).map((field) => (
                  <input
                    key={`primary-${field}`}
                    className={CRM_FIELD_LIGHT}
                    value={people[0]?.[field] ?? ""}
                    placeholder={personPlaceholder(field)}
                    autoComplete="off"
                    name={`crm-person-0-${field}`}
                    onChange={(event) =>
                      updatePerson(0, field, event.target.value)
                    }
                    onBlur={() => flushPeople()}
                  />
                ))}
              </div>
              <p className={cn(CRM_LABEL_LIGHT, "mt-3")}>{COPY.crmCompanyPhone}</p>
              <div className="mt-1.5">
                {phoneOptions.length > 1 ? (
                  <select
                    className={CRM_FIELD_LIGHT}
                    value={companyPhone}
                    name="crm-company-phone"
                    onChange={(event) => selectCompanyPhone(event.target.value)}
                  >
                    {phoneOptions.map((phone) => (
                      <option key={phone} value={phone}>
                        {formatPhoneDisplay(phone)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    ref={companyPhoneRef}
                    type="tel"
                    inputMode="tel"
                    className={CRM_FIELD_LIGHT}
                    value={companyPhone}
                    autoComplete="off"
                    name="crm-company-phone"
                    maxLength={24}
                    placeholder="(34) 99999-0000"
                    onChange={(event) => {
                      const rest = phonesRef.current.slice(1);
                      queuePhones([event.target.value, ...rest]);
                    }}
                    onBlur={() => flushPhones()}
                  />
                )}
              </div>
              <button
                type="button"
                disabled={saving || !companyPhone.trim()}
                onClick={() => startCall(companyPhone)}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-podium-yellow px-2.5 py-1.5 text-[11px] font-medium text-podium-navy hover:brightness-110 disabled:opacity-50"
              >
                <Phone className="h-3.5 w-3.5" />
                {COPY.crmCallNow}
              </button>
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-2.5">
              <p className={CRM_LABEL_LIGHT}>{COPY.crmPeopleTitle}</p>
              <div className="mt-1.5 flex flex-col gap-3">
                {extraPeople.map((person, offset) => {
                  const index = offset + 1;
                  return (
                    <div key={`person-${index}`} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-zinc-400">
                          Pessoa {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = peopleRef.current.filter((_, i) => i !== index);
                            peopleRef.current = next;
                            setPeople(next);
                            void persistPeople(next);
                          }}
                          className="rounded-md p-0.5 text-zinc-300 hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {(["name", "phone", "email"] as const).map((field) => (
                        <input
                          key={`${index}-${field}`}
                          className={CRM_FIELD_LIGHT}
                          value={person[field]}
                          autoComplete="off"
                          name={`crm-person-${index}-${field}`}
                          placeholder={personPlaceholder(field)}
                          onChange={(event) =>
                            updatePerson(index, field, event.target.value)
                          }
                          onBlur={() => flushPeople()}
                        />
                      ))}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const next = [...peopleRef.current, emptyPerson()];
                    peopleRef.current = next;
                    setPeople(next);
                  }}
                  className="inline-flex items-center gap-1 self-start text-[10px] font-medium text-zinc-500 hover:text-zinc-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {COPY.crmAddPerson}
                </button>
              </div>
              <p className={cn(CRM_LABEL_LIGHT, "mt-3")}>{COPY.crmSecretaryName}</p>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {secretaries.map((name, index) => (
                  <div key={`secretary-${index}`} className="flex gap-1.5">
                    <input
                      className={CRM_FIELD_LIGHT}
                      value={name}
                      autoComplete="off"
                      name={`crm-secretary-${index}`}
                      placeholder={COPY.crmSecretaryName}
                      onChange={(event) => {
                        const next = secretariesRef.current.map((row, i) =>
                          i === index ? event.target.value : row,
                        );
                        queueSecretaries(next);
                      }}
                      onBlur={() => flushSecretaries()}
                    />
                    {secretaries.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = secretariesRef.current.filter(
                            (_, i) => i !== index,
                          );
                          queueSecretaries(next);
                          void persistSecretaries(next);
                        }}
                        className="rounded-md p-0.5 text-zinc-300 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    queueSecretaries([...secretariesRef.current, ""]);
                  }}
                  className="inline-flex items-center gap-1 self-start text-[10px] font-medium text-zinc-500 hover:text-zinc-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {COPY.crmAddSecretary}
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void remove()}
              className="mt-auto text-[11px] text-zinc-400 hover:text-red-600"
            >
              Tirar da pista
            </button>
          </aside>
        </div>
      </motion.div>
    </motion.div>
  );
}
