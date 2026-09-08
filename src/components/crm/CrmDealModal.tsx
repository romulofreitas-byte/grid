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
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { CrmDateTimePicker } from "@/components/crm/CrmDateTimePicker";
import { CrmDealGridAttach } from "@/components/crm/CrmDealGridAttach";
import { CrmStageChevronBar } from "@/components/crm/CrmStageChevronBar";
import { CrmWinCelebration } from "@/components/crm/CrmWinCelebration";
import { GridPresenceIcons } from "@/components/GridPresenceIcons";
import { CallConfirmDialog } from "@/components/CallConfirmDialog";
import { Select } from "@/components/ui/Select";
import { COPY } from "@/lib/copy";
import { formatNichoCidade } from "@/lib/nicho-cidade";
import { leadHrefForCnpj } from "@/lib/back";
import {
  activitySignal,
  defaultNextDueLocal,
  formatDueLabel,
  formatPlannedActivity,
  fromDatetimeLocal,
  openActivitiesOf,
} from "@/lib/crm/activity";
import {
  buildCrmBriefing,
  CRM_CARD_PRESENCE_IDS,
  mergeSourcedPhones,
  type CrmBriefing,
  type CrmPhoneSourceKind,
} from "@/lib/crm/briefing";
import { CRM_FIELD, CRM_LABEL, crmFetch } from "@/lib/crm/client";
import {
  crmDealAttachSurface,
} from "@/lib/crm/company-attach";
import { formAnswersTitle } from "@/lib/crm/inbound-examples";
import {
  getCachedDealBriefing,
  getCachedDealEvents,
  loadDealBriefing,
  loadDealEvents,
  setCachedDealBriefing,
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
  mergePeopleWithSocios,
  peopleFromDeal,
  peopleListsEqual,
  sanitizePeople,
  sanitizeSecretaries,
} from "@/lib/crm/people";
import type {
  CrmActivityKind,
  CrmDealCard,
  CrmEvent,
  CrmOutcome,
  CrmPerson,
  CrmPipelineSummary,
  CrmStage,
} from "@/lib/crm/types";
import { formatCentsInput, maskDealAmountTyping, parseBrlToCents } from "@/lib/crm/money";
import { normalizePhoneBR, phonesMatch } from "@/lib/phone";
import { recordCrmDialAfterCall } from "@/lib/crm/record-dial";
import { invalidateLiveStats } from "@/lib/live-stats";
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

function CopyPhoneChip({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);
  const display = formatPhoneDisplay(phone);
  const label = copied ? COPY.crmCopiedPhone : COPY.crmCopyPhone;

  useEffect(() => {
    setCopied(false);
  }, [phone]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      return;
    }
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => void copy()}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-podium-gray transition hover:border-white/20 hover:bg-white/[0.08] hover:text-podium-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40"
    >
      {copied ? (
        <Check className="h-3 w-3 text-podium-yellow" />
      ) : (
        <Phone className="h-3 w-3" />
      )}
      {display}
    </button>
  );
}

function cleanedPhones(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

const PHONE_SOURCE_HINT: Record<CrmPhoneSourceKind, string> = {
  site: COPY.crmPhoneSourceSite,
  receita: COPY.crmPhoneSourceReceita,
  maps: COPY.crmPhoneSourceMaps,
  crm: COPY.crmPhoneSourceCrm,
};

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

function secretariesFromDeal(deal: { secretaries: CrmPerson[] }): CrmPerson[] {
  return deal.secretaries.length > 0 ? deal.secretaries : [emptyPerson()];
}

type PeopleCardKey = `secretary:${number}` | `person:${number}`;

function PersonContactCard({
  person,
  namePlaceholder,
  expanded,
  nameAlwaysEditable,
  canRemove,
  fieldPrefix,
  onExpand,
  onCollapse,
  onChange,
  onSave,
  onRemove,
}: {
  person: CrmPerson;
  namePlaceholder: string;
  expanded: boolean;
  nameAlwaysEditable: boolean;
  canRemove: boolean;
  fieldPrefix: string;
  onExpand: () => void;
  onCollapse: () => void;
  onChange: (field: keyof CrmPerson, value: string) => void;
  onSave: () => void;
  onRemove?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const onSaveRef = useRef(onSave);
  const onCollapseRef = useRef(onCollapse);
  onSaveRef.current = onSave;
  onCollapseRef.current = onCollapse;

  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(event: PointerEvent) {
      const root = cardRef.current;
      if (!root || root.contains(event.target as Node)) return;
      onSaveRef.current();
      onCollapseRef.current();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded]);

  useEffect(() => {
    if (!expanded || nameAlwaysEditable) return;
    const id = window.requestAnimationFrame(() => {
      if (nameRef.current?.value.trim()) {
        phoneRef.current?.focus();
      } else {
        nameRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [expanded, nameAlwaysEditable]);

  function handleCardBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (!(next instanceof Node)) return;
    if (event.currentTarget.contains(next)) return;
    onSave();
    if (expanded) onCollapse();
  }

  const nameInput = (
    <input
      ref={nameRef}
      className={cn(CRM_FIELD, "min-w-0 truncate font-medium")}
      value={person.name}
      autoComplete="off"
      name={`${fieldPrefix}-name`}
      placeholder={namePlaceholder}
      onPointerDown={onExpand}
      onFocus={onExpand}
      onChange={(event) => onChange("name", event.target.value)}
      onBlur={onSave}
    />
  );

  return (
    <div
      ref={cardRef}
      className="flex flex-col gap-1.5"
      onBlur={handleCardBlur}
    >
      {nameAlwaysEditable || expanded ? (
        <div className="flex gap-1">
          {nameInput}
          {canRemove && onRemove && expanded ? (
            <button
              type="button"
              aria-label="Remover"
              onClick={onRemove}
              className="shrink-0 rounded-md p-1.5 text-podium-muted hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          aria-expanded={false}
          onClick={onExpand}
          className={cn(
            "w-full truncate rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-white/[0.04]",
            person.name.trim() ? "text-podium-white" : "text-podium-muted",
          )}
        >
          {person.name.trim() || namePlaceholder}
        </button>
      )}
      {expanded ? (
        <>
          <input
            ref={phoneRef}
            className={CRM_FIELD}
            value={person.phone}
            autoComplete="off"
            name={`${fieldPrefix}-phone`}
            placeholder={personPlaceholder("phone")}
            onChange={(event) => onChange("phone", event.target.value)}
            onBlur={onSave}
          />
          <input
            className={CRM_FIELD}
            value={person.email}
            autoComplete="off"
            name={`${fieldPrefix}-email`}
            placeholder={personPlaceholder("email")}
            onChange={(event) => onChange("email", event.target.value)}
            onBlur={onSave}
          />
        </>
      ) : null}
    </div>
  );
}

export function CrmDealModal({
  deal,
  stages,
  pipelineNome,
  pipelines = [],
  onClose,
  onChange,
  onDeleted,
  onTransferred,
  onMoveStage,
}: {
  deal: CrmDealCard;
  stages: CrmStage[];
  pipelineNome: string;
  pipelines?: CrmPipelineSummary[];
  onClose: () => void;
  onChange: (deal: CrmDealCard) => void;
  onDeleted: (dealId: string) => void;
  onTransferred?: (result: {
    fromDealId: string;
    fromPipelineId: string;
    deal: CrmDealCard;
    merged: boolean;
  }) => void;
  onMoveStage: (stageId: string) => void;
}) {
  const qc = useQueryClient();
  const [people, setPeople] = useState(() => peopleFromDeal(deal));
  const [secretaries, setSecretaries] = useState(() =>
    secretariesFromDeal(deal),
  );
  const [openCard, setOpenCard] = useState<PeopleCardKey | null>(null);
  const [phones, setPhones] = useState(
    deal.phones.length > 0 ? deal.phones : [""],
  );
  const [briefing, setBriefing] = useState<CrmBriefing>(
    () => getCachedDealBriefing(deal.id) ?? buildCrmBriefing(deal, null),
  );
  const [briefingReady, setBriefingReady] = useState(
    () => Boolean(getCachedDealBriefing(deal.id)),
  );
  const [composerKind, setComposerKind] = useState<CrmComposerKind>(
    () => deal.next_activity?.kind ?? "ligar",
  );
  const [composerOpen, setComposerOpen] = useState(true);
  const [body, setBody] = useState("");
  const [events, setEvents] = useState<CrmEvent[]>(
    () => getCachedDealEvents(deal.id) ?? [],
  );
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dueLocal, setDueLocal] = useState(defaultNextDueLocal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callPrompt, setCallPrompt] = useState<{ phone: string } | null>(null);
  const [celebrateCompany, setCelebrateCompany] = useState<string | null>(
    null,
  );
  const [amountDraft, setAmountDraft] = useState(() =>
    formatCentsInput(deal.amount_cents),
  );
  const [needAmount, setNeedAmount] = useState(false);
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
  const amountRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const briefingGen = useRef(0);
  const mergedSociosForDeal = useRef<string | null>(null);

  useEffect(() => {
    setPeople(peopleFromDeal(deal));
  }, [deal]);

  useEffect(() => {
    mergedSociosForDeal.current = null;
    setOpenCard(null);
  }, [deal.id]);

  useEffect(() => {
    if (!briefingReady) return;
    if (mergedSociosForDeal.current === deal.id) return;
    const current = peopleRef.current;
    const primary = current[0] ?? emptyPerson();
    const seeded =
      !primary.name.trim() && briefing.decisor?.trim()
        ? [{ ...primary, name: briefing.decisor.trim() }, ...current.slice(1)]
        : current;
    const next = mergePeopleWithSocios(
      seeded,
      briefing.socios ?? [],
      secretariesRef.current,
    );
    mergedSociosForDeal.current = deal.id;
    if (peopleListsEqual(sanitizePeople(current), next)) return;
    peopleRef.current = next;
    setPeople(next);
    void persistPeople(next);
  }, [briefingReady, briefing.socios, briefing.decisor, deal.id]);

  useEffect(() => {
    setPhones(deal.phones.length > 0 ? deal.phones : [""]);
    setSecretaries(secretariesFromDeal(deal));
    setBody("");
    setComposerKind("ligar");
    setComposerOpen(true);
    setDueLocal(defaultNextDueLocal());
    setExpandedEventId(null);
    setDrafts({});
    setAmountDraft(formatCentsInput(deal.amount_cents));
    setNeedAmount(false);
  }, [deal.id]);

  useEffect(() => {
    setAmountDraft(formatCentsInput(deal.amount_cents));
  }, [deal.amount_cents]);

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
    const gen = ++briefingGen.current;
    const cached = getCachedDealBriefing(deal.id);
    if (cached) {
      setBriefing(cached);
      setBriefingReady(true);
      return;
    }
    setBriefingReady(false);
    setBriefing(buildCrmBriefing(deal, null));
    void loadDealBriefing(deal.id, async () => {
      const res = await crmFetch<{ briefing: CrmBriefing }>(
        `/api/crm/deals/${deal.id}/briefing`,
      );
      return res.briefing;
    })
      .then((next) => {
        if (!cancelled && gen === briefingGen.current) {
          setBriefing(next);
          setBriefingReady(true);
        }
      })
      .catch(() => {
        if (!cancelled && gen === briefingGen.current) {
          setBriefing(buildCrmBriefing(deal, null));
          setBriefingReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deal.id, deal.cnpj]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (celebrateCompany || callPrompt) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, celebrateCompany, callPrompt]);

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

  function queueSecretaries(next: CrmPerson[]) {
    secretariesRef.current = next.length > 0 ? next : [emptyPerson()];
    setSecretaries(secretariesRef.current);
  }

  async function persistSecretaries(next: CrmPerson[]) {
    try {
      await patch({ secretaries: sanitizeSecretaries(next) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou a secretária.");
    }
  }

  function flushSecretaries(next = secretariesRef.current) {
    const ready = sanitizeSecretaries(next);
    const shown = ready.length > 0 ? ready : [emptyPerson()];
    secretariesRef.current = shown;
    setSecretaries(shown);
    void persistSecretaries(next);
  }

  function updateSecretary(index: number, field: keyof CrmPerson, value: string) {
    const next = secretariesRef.current.map((person, i) =>
      i === index ? { ...person, [field]: value } : person,
    );
    queueSecretaries(next);
  }

  async function persistAmount(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setAmountDraft("");
      if (deal.amount_cents == null) return;
      try {
        await patch({ amount_cents: null });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não salvou o valor.");
      }
      return;
    }
    const cents = parseBrlToCents(trimmed);
    if (cents == null) {
      setAmountDraft(formatCentsInput(deal.amount_cents));
      setError("Valor inválido.");
      return;
    }
    setAmountDraft(formatCentsInput(cents));
    if (cents === deal.amount_cents) return;
    try {
      await patch({ amount_cents: cents });
      setNeedAmount(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou o valor.");
    }
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
      ...secretariesRef.current.flatMap((person) =>
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

  function askCall(phone?: string) {
    setError(null);
    const target = phone ?? firstDialablePhone(dialTargets());
    if (!target) {
      companyPhoneRef.current?.focus();
      setError(COPY.crmNoPhone);
      return;
    }
    const href = telHrefFromPhone(target);
    if (!href) {
      setError(COPY.crmNoPhone);
      return;
    }
    setCallPrompt({ phone: target });
  }

  function confirmCall() {
    const phone = callPrompt?.phone;
    if (!phone) return;
    setError(null);
    setCallPrompt(null);
    if (!dialPhone(phone)) return;
    void recordCallAfterDial();
  }

  async function recordCallAfterDial() {
    try {
      const result = await recordCrmDialAfterCall(deal);
      onChange(result.deal);
      void invalidateLiveStats(qc);
      if (result.event) prependEvent(result.event);
      if (result.events) {
        setCachedDealEvents(deal.id, result.events);
        setEvents(result.events);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não registrou a ligação.");
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

  async function refreshBriefing() {
    const gen = ++briefingGen.current;
    const res = await crmFetch<{ briefing: CrmBriefing }>(
      `/api/crm/deals/${deal.id}/briefing`,
    );
    if (gen !== briefingGen.current) return;
    setCachedDealBriefing(deal.id, res.briefing);
    setBriefing(res.briefing);
    setBriefingReady(true);
  }

  async function saveRegister() {
    const note = body.trim();
    if (!note) {
      setError(COPY.crmRegisterNeedBody);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await crmFetch<{ deal: CrmDealCard; event: CrmEvent }>(
        `/api/crm/deals/${deal.id}/events`,
        {
          method: "POST",
          body: JSON.stringify({
            kind: composerKind,
            body: note,
          }),
        },
      );
      onChange(res.deal);
      prependEvent(res.event);
      setBody("");
      void invalidateLiveStats(qc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não registrou.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
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
      void invalidateLiveStats(qc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não agendou.");
    } finally {
      setSaving(false);
    }
  }

  async function completePlanned(activityId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await crmFetch<{ deal: CrmDealCard; event: CrmEvent }>(
        `/api/crm/deals/${deal.id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ activityId }),
        },
      );
      onChange(res.deal);
      prependEvent(res.event);
      void invalidateLiveStats(qc);
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
    const wasWon = deal.outcome === "won";
    try {
      const res = await crmFetch<{ deal: CrmDealCard; event: CrmEvent }>(
        `/api/crm/deals/${deal.id}/outcome`,
        { method: "POST", body: JSON.stringify({ outcome }) },
      );
      onChange(res.deal);
      prependEvent(res.event);
      void invalidateLiveStats(qc);
      if (outcome === "won" && !wasWon) {
        setCelebrateCompany(res.deal.company_name);
        if (res.deal.amount_cents == null) {
          setNeedAmount(true);
          window.setTimeout(() => amountRef.current?.focus(), 80);
        }
      }
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
      void invalidateLiveStats(qc);
      onDeleted(deal.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não excluiu.");
      setSaving(false);
    }
  }

  async function transferTo(pipelineId: string) {
    if (!pipelineId || pipelineId === deal.pipeline_id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await crmFetch<{
        deal: CrmDealCard;
        fromPipelineId: string;
        fromDealId: string;
        merged: boolean;
      }>(`/api/crm/deals/${deal.id}/transfer`, {
        method: "POST",
        body: JSON.stringify({ pipelineId }),
      });
      onTransferred?.(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível transferir.",
      );
      setSaving(false);
    }
  }

  function selectTab(id: CrmComposerKind) {
    if (id === composerKind && composerOpen) {
      setComposerOpen(false);
      return;
    }
    setComposerKind(id);
    setComposerOpen(true);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
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
  const phoneOptions = mergeSourcedPhones([
    ...cleanedPhones(phones).map((phone) => ({ phone, source: "crm" as const })),
    ...(briefing.phoneSources ?? []),
  ]);
  const companyPhone = phones[0]?.trim() || phoneOptions[0]?.phone || "";
  const headerPhone =
    firstDialablePhone([companyPhone, ...dialTargets()]) ??
    briefing.phone ??
    null;
  const headerContact = people[0]?.name.trim() || briefing.contact;
  const openActions = openActivitiesOf(deal);
  const nichoCidade = formatNichoCidade(pipelineNome, briefing.municipio);
  const presenceHits = briefing.assets
    .filter((asset) => asset.found && asset.href)
    .map((asset) => ({
      id: asset.id,
      href: asset.href!,
      unverified: Boolean(asset.unverified),
    }));
  const attachInput = {
    cnpj: deal.cnpj,
    source: deal.meta.source,
    audited: briefing.audited,
    briefingReady,
  };
  const attachSurface = crmDealAttachSurface(attachInput);
  const attach = attachSurface ? (
    <CrmDealGridAttach
      deal={deal}
      onChange={onChange}
      audited={briefing.audited}
      briefingReady={briefingReady}
      onQualified={() => refreshBriefing()}
      surface={attachSurface}
    />
  ) : null;

  return (
    <>
      <CrmWinCelebration
        companyName={celebrateCompany}
        onDone={() => setCelebrateCompany(null)}
      />
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-5"
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
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border-0 border-white/10 bg-podium-navy text-podium-white shadow-2xl md:h-[min(92vh,56rem)] md:w-[min(96vw,88rem)] md:rounded-lg md:border"
        initial={reduce ? false : { scale: 0.98 }}
        animate={{ scale: 1 }}
        exit={reduce ? undefined : { scale: 0.98 }}
        transition={presence}
      >
        {attachSurface === "banner" ? attach : null}
        <header className="flex shrink-0 flex-col gap-2 border-b border-white/10 px-3 py-3 md:px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2
                  id="crm-deal-title"
                  className="truncate text-sm font-semibold leading-tight text-podium-white"
                >
                  {deal.company_name}
                </h2>
                {deal.cnpj ? (
                  <Link
                    href={leadHrefForCnpj(deal.cnpj, deal.meta.searchId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-podium-yellow hover:underline"
                  >
                    {COPY.crmOpenFicha}
                  </Link>
                ) : null}
              </div>
              {nichoCidade ? (
                <p className="mt-0.5 truncate text-[10px] text-podium-muted">
                  {nichoCidade}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-start gap-1.5">
              <div className="flex rounded-md border border-white/10 p-0.5">
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
                          ? "text-emerald-400"
                          : id === "lost"
                            ? "text-red-400"
                            : "text-podium-yellow"
                        : "text-podium-muted hover:text-podium-gray",
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
                className="rounded-md p-1.5 text-podium-muted hover:bg-white/5 hover:text-podium-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {headerPhone ? (
              <CopyPhoneChip phone={headerPhone} />
            ) : (
              <span className="text-[11px] text-podium-muted">{COPY.crmNoPhone}</span>
            )}
            {headerContact ? (
              <span className="truncate text-xs text-podium-gray">
                {headerContact}
              </span>
            ) : null}
            <button
              type="button"
              disabled={saving || !headerPhone}
              onClick={() => askCall(headerPhone ?? undefined)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md bg-podium-yellow px-3 text-sm font-medium text-podium-navy hover:brightness-110 disabled:opacity-50 md:min-h-0 md:px-2.5 md:py-1 md:text-[11px]"
            >
              <Phone className="h-4 w-4 md:h-3.5 md:w-3.5" />
              {COPY.crmCallNow}
            </button>
            <button
              type="button"
              disabled={saving || !headerPhone}
              onClick={() => startWhatsapp()}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-white/15 bg-white/[0.04] px-3 text-sm font-medium text-podium-gray hover:border-podium-yellow/35 hover:text-podium-white disabled:opacity-50 md:min-h-0 md:px-2.5 md:py-1 md:text-[11px]"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {COPY.crmWhatsappNow}
            </button>
            {deal.cnpj && briefing.audited ? (
              <GridPresenceIcons
                presence={presenceHits}
                showMissing
                ids={CRM_CARD_PRESENCE_IDS}
                iconClassName="h-3.5 w-3.5"
                className="ml-0.5 gap-1"
              />
            ) : null}
          </div>
        </header>

        <CrmStageChevronBar
          stages={stages}
          activeId={deal.stage_id}
          onSelect={onMoveStage}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:flex-row md:p-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 overflow-hidden">
            <div className="shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
              <div className="flex flex-wrap gap-1 border-b border-white/10 p-2">
                {CRM_COMPOSER_KINDS.map((id) => {
                  const Icon = COMPOSER_ICONS[id];
                  const selected = composerKind === id && composerOpen;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-expanded={selected}
                      onClick={() => selectTab(id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition",
                        selected
                          ? "border-podium-yellow/50 bg-podium-yellow/10 text-podium-yellow"
                          : "border-transparent text-podium-muted hover:border-white/10 hover:text-podium-white",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {COMPOSER_TAB_LABELS[id]}
                    </button>
                  );
                })}
              </div>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  composerOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="p-2.5">
                    <textarea
                      ref={textareaRef}
                      className={cn(CRM_FIELD, "min-h-16 resize-y")}
                      value={body}
                      autoComplete="off"
                      onChange={(event) => setBody(event.target.value)}
                      placeholder={COPY.crmComposerPlaceholder}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CrmDateTimePicker
                        value={dueLocal || defaultNextDueLocal()}
                        onChange={setDueLocal}
                      />
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          title={
                            composerKind === "followup"
                              ? COPY.crmScheduleHintFollowup
                              : COPY.crmScheduleHint
                          }
                          onClick={() => void saveSchedule()}
                          className="rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-podium-gray hover:border-podium-yellow/35 hover:text-podium-white disabled:opacity-50"
                        >
                          <span className="md:hidden">{COPY.crmSchedule}</span>
                          <span className="hidden md:inline">
                            {COPY.crmScheduleDesktop}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          title={COPY.crmLogCallHint}
                          onClick={() => void saveRegister()}
                          className="rounded-md bg-podium-yellow px-2.5 py-1 text-[11px] font-medium text-podium-navy hover:brightness-110 disabled:opacity-50"
                        >
                          <span className="md:hidden">{COPY.crmLogCall}</span>
                          <span className="hidden md:inline">
                            {COPY.crmLogCallDesktop}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {error ? <p className="text-xs text-podium-alert">{error}</p> : null}

            <div className="crm-ficha-aside-scroll flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
              <p className={CRM_LABEL}>{COPY.crmOpenActionsTitle}</p>
              <div className="mt-1.5 space-y-1.5">
                {openActions.map((activity) => {
                  const Icon = COMPOSER_ICONS[activity.kind] ?? StickyNote;
                  const signal = activitySignal(activity);
                  const when = formatDueLabel(activity.due_at);
                  return (
                    <article
                      key={activity.id}
                      className={cn(
                        "rounded-md border px-2.5 py-2",
                        signal === "overdue"
                          ? "border-red-500/30 bg-red-500/10"
                          : signal === "today"
                            ? "border-podium-yellow/25 bg-podium-yellow/10"
                            : "border-white/10 bg-white/[0.04]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-podium-yellow" />
                        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-podium-white">
                          {formatPlannedActivity(activity)}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            signal === "overdue"
                              ? "bg-red-500/15 text-red-300"
                              : signal === "today"
                                ? "bg-podium-yellow/15 text-podium-yellow"
                                : "bg-white/5 text-podium-muted",
                          )}
                        >
                          {signal === "overdue"
                            ? COPY.crmHistoryTodoOverdue
                            : signal === "today"
                              ? COPY.crmHistoryTodoToday
                              : when}
                        </span>
                        {activity.kind === "ligar" ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => askCall()}
                            className="inline-flex items-center gap-0.5 text-[10px] text-podium-muted hover:text-podium-white disabled:opacity-50"
                          >
                            <Phone className="h-3 w-3" />
                            {COPY.crmCallNow}
                          </button>
                        ) : activity.kind === "whatsapp" ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => startWhatsapp()}
                            className="inline-flex items-center gap-0.5 text-[10px] text-podium-muted hover:text-podium-white disabled:opacity-50"
                          >
                            <MessageCircle className="h-3 w-3" />
                            {COPY.crmWhatsappNow}
                          </button>
                        ) : null}
                        <label className="inline-flex cursor-pointer items-center gap-1 text-[10px] text-podium-muted hover:text-podium-gray">
                          <input
                            type="checkbox"
                            disabled={saving}
                            aria-label={COPY.crmMarkDone}
                            onChange={(event) => {
                              event.currentTarget.checked = false;
                              void completePlanned(activity.id);
                            }}
                            className="h-3 w-3 rounded-sm border-white/20 text-podium-yellow accent-podium-yellow disabled:opacity-50"
                          />
                          {COPY.crmMarkDone}
                        </label>
                      </div>
                    </article>
                  );
                })}
                <p className={cn(CRM_LABEL, openActions.length ? "pt-2" : "")}>
                  {COPY.crmHistoryTitle}
                </p>
                {events.length === 0 && openActions.length === 0 ? (
                  <p className="text-xs text-podium-muted">{COPY.crmHistoryEmpty}</p>
                ) : (
                  events.map((event) => {
                    const Icon =
                      COMPOSER_ICONS[event.kind as CrmComposerKind] ?? StickyNote;
                    const expanded = expandedEventId === event.id;
                    const draft = drafts[event.id] ?? event.body;
                    return (
                      <article
                        key={event.id}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2"
                      >
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 text-left"
                          onClick={() => {
                            setExpandedEventId(expanded ? null : event.id);
                            setDrafts((current) => ({
                              ...current,
                              [event.id]: event.body,
                            }));
                          }}
                        >
                          <Icon className="mt-0.5 h-3 w-3 shrink-0 text-podium-yellow" />
                          <span className="min-w-0 flex-1">
                            <span className="text-[11px] font-medium text-podium-white">
                              {eventTitle(event)}
                            </span>
                            {!expanded && event.body ? (
                              <span className="mt-0.5 block line-clamp-2 whitespace-pre-wrap text-xs text-podium-gray">
                                {event.body}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[10px] text-podium-muted">
                            {formatEventWhen(event.created_at)}
                          </span>
                        </button>
                        {expanded ? (
                          <div className="mt-2">
                            <textarea
                              className={cn(CRM_FIELD, "min-h-16 resize-y")}
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
                              className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-podium-yellow px-2 py-0.5 text-[10px] font-medium text-podium-navy hover:brightness-110 disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" />
                              {COPY.crmSaveHistory}
                            </button>
                          </div>
                        ) : null}
                        {event.meta.phone ? (
                          <p className="mt-1 font-mono text-[10px] text-podium-muted">
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

          <aside className="crm-ficha-aside-scroll flex w-full shrink-0 flex-col gap-3 overflow-y-auto md:w-[17rem]">
            <label className="flex flex-col rounded-md border border-podium-yellow/40 bg-podium-yellow/10 p-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-podium-yellow">
                {COPY.crmDealAmount}
              </span>
              <input
                ref={amountRef}
                className="mt-1.5 w-full border-0 bg-transparent p-0 text-lg font-semibold tracking-tight text-podium-white outline-none placeholder:text-podium-muted/70"
                value={amountDraft}
                inputMode="decimal"
                autoComplete="off"
                name="crm-deal-amount"
                placeholder={COPY.crmDealAmountPlaceholder}
                onChange={(event) =>
                  setAmountDraft(maskDealAmountTyping(event.target.value))
                }
                onBlur={() => void persistAmount(amountDraft)}
              />
            </label>
            {briefing.address || briefing.cnae ? (
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
                {briefing.address ? (
                  <p className="text-[11px] leading-snug text-podium-gray">
                    {briefing.address}
                  </p>
                ) : null}
                {briefing.cnae ? (
                  <p className={cn("text-[10px] text-podium-muted", briefing.address && "mt-1")}>
                    {briefing.cnae}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
              <p className={CRM_LABEL}>{COPY.crmCompanyPhone}</p>
              <div className="mt-1.5">
                {phoneOptions.length > 0 ? (
                  <Select
                    size="sm"
                    className="w-full"
                    value={companyPhone}
                    name="crm-company-phone"
                    aria-label={COPY.crmCompanyPhone}
                    onChange={selectCompanyPhone}
                    options={phoneOptions.map((row) => ({
                      value: row.phone,
                      label: formatPhoneDisplay(row.phone),
                      hint: PHONE_SOURCE_HINT[row.source],
                    }))}
                  />
                ) : (
                  <input
                    ref={companyPhoneRef}
                    type="tel"
                    inputMode="tel"
                    className={CRM_FIELD}
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
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
              <p className={CRM_LABEL}>{COPY.crmPeopleTitle}</p>
              <div className="mt-1.5 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-podium-muted">
                    {COPY.crmSecretaryLabel}
                  </span>
                  {secretaries.map((person, index) => {
                    const key: PeopleCardKey = `secretary:${index}`;
                    return (
                      <PersonContactCard
                        key={key}
                        person={person}
                        namePlaceholder={COPY.crmSecretaryName}
                        expanded={openCard === key}
                        nameAlwaysEditable
                        canRemove={secretaries.length > 1}
                        fieldPrefix={`crm-secretary-${index}`}
                        onExpand={() => setOpenCard(key)}
                        onCollapse={() =>
                          setOpenCard((current) =>
                            current === key ? null : current,
                          )
                        }
                        onChange={(field, value) =>
                          updateSecretary(index, field, value)
                        }
                        onSave={() => flushSecretaries()}
                        onRemove={() => {
                          const next = secretariesRef.current.filter(
                            (_, i) => i !== index,
                          );
                          queueSecretaries(next);
                          void persistSecretaries(next);
                          setOpenCard(null);
                        }}
                      />
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...secretariesRef.current, emptyPerson()];
                      queueSecretaries(next);
                      setOpenCard(`secretary:${next.length - 1}`);
                    }}
                    className="inline-flex items-center gap-1 self-start text-[10px] font-medium text-podium-muted hover:text-podium-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {COPY.crmAddSecretary}
                  </button>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-podium-muted">
                    {COPY.crmContactLabel}
                  </span>
                  {people.map((person, index) => {
                    const key: PeopleCardKey = `person:${index}`;
                    return (
                      <PersonContactCard
                        key={key}
                        person={person}
                        namePlaceholder={
                          index === 0
                            ? briefing.decisor || personPlaceholder("name")
                            : personPlaceholder("name")
                        }
                        expanded={openCard === key}
                        nameAlwaysEditable={false}
                        canRemove={false}
                        fieldPrefix={`crm-person-${index}`}
                        onExpand={() => setOpenCard(key)}
                        onCollapse={() =>
                          setOpenCard((current) =>
                            current === key ? null : current,
                          )
                        }
                        onChange={(field, value) =>
                          updatePerson(index, field, value)
                        }
                        onSave={() => flushPeople()}
                        onRemove={() => {
                          const next = peopleRef.current.filter(
                            (_, i) => i !== index,
                          );
                          peopleRef.current = next;
                          setPeople(next);
                          void persistPeople(next);
                          setOpenCard(null);
                        }}
                      />
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...peopleRef.current, emptyPerson()];
                      peopleRef.current = next;
                      setPeople(next);
                      setOpenCard(`person:${next.length - 1}`);
                    }}
                    className="inline-flex items-center gap-1 self-start pt-1 text-[10px] font-medium text-podium-muted hover:text-podium-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {COPY.crmAddPerson}
                  </button>
                </div>
              </div>
            </div>

            {attachSurface === "aside" ? attach : null}
            {deal.meta.form_answers &&
            Object.keys(deal.meta.form_answers).length > 0 ? (
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
                <p className={CRM_LABEL}>
                  {formAnswersTitle(deal.meta.form_channel)}
                </p>
                <dl className="mt-1.5 space-y-1">
                  {Object.entries(deal.meta.form_answers).map(([key, value]) => (
                    <div key={key} className="flex gap-2 text-[11px]">
                      <dt className="shrink-0 text-podium-muted">{key}</dt>
                      <dd className="min-w-0 break-words text-podium-gray">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <button
              type="button"
              disabled={saving}
              onClick={() => void remove()}
              className="mt-auto text-[11px] text-podium-muted hover:text-red-400"
            >
              Tirar do CRM
            </button>
            {pipelines.filter((row) => row.id !== deal.pipeline_id).length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className={CRM_LABEL}>{COPY.crmTransferPipeline}</p>
                <Select
                  size="sm"
                  value=""
                  disabled={saving}
                  placeholder={COPY.crmTransferPipeline}
                  aria-label={COPY.crmTransferPipeline}
                  onChange={(value) => void transferTo(value)}
                  options={pipelines
                    .filter((row) => row.id !== deal.pipeline_id)
                    .map((row) => ({ value: row.id, label: row.nome }))}
                />
                <p className="text-[10px] leading-snug text-podium-muted">
                  {COPY.crmTransferPipelineHint}
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </motion.div>
    </motion.div>
      <CallConfirmDialog
        open={Boolean(callPrompt)}
        companyName={deal.company_name}
        phoneLabel={callPrompt ? formatPhoneDisplay(callPrompt.phone) : null}
        pending={false}
        onClose={() => setCallPrompt(null)}
        onConfirm={() => confirmCall()}
      />
    </>
  );
}
