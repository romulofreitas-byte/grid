"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CrmDateTimePicker } from "@/components/crm/CrmDateTimePicker";
import { COPY } from "@/lib/copy";
import {
  CRM_ACTIVITY_KIND_LABELS,
  defaultNextDueLocal,
  fromDatetimeLocal,
  toDatetimeLocal,
} from "@/lib/crm/activity";
import { CRM_FIELD, CRM_LABEL, crmFetch } from "@/lib/crm/client";
import { CRM_ACTIVITY_KINDS } from "@/lib/crm/types";
import type { CrmActivityKind, CrmDealCard } from "@/lib/crm/types";
import { normalizePhoneBR } from "@/lib/phone";
import { cn } from "@/lib/utils";

function formatPhoneDisplay(raw: string): string {
  const parsed = normalizePhoneBR(raw);
  if (!parsed || parsed.display.length > 24) return raw;
  return parsed.display;
}

function cleanedPhones(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function CrmDealDrawer({
  deal,
  onClose,
  onChange,
  onDeleted,
}: {
  deal: CrmDealCard;
  onClose: () => void;
  onChange: (deal: CrmDealCard) => void;
  onDeleted: (dealId: string) => void;
}) {
  const [company, setCompany] = useState(deal.company_name);
  const [contact, setContact] = useState(deal.contact_name);
  const [secretaries, setSecretaries] = useState(deal.secretaries);
  const [phones, setPhones] = useState(
    deal.phones.length > 0 ? deal.phones : [""],
  );
  const [notes, setNotes] = useState(deal.notes);
  const [kind, setKind] = useState<CrmActivityKind>(
    deal.next_activity?.kind ?? "ligar",
  );
  const [dueLocal, setDueLocal] = useState(
    deal.next_activity
      ? toDatetimeLocal(deal.next_activity.due_at)
      : defaultNextDueLocal(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phonesRef = useRef(phones);
  phonesRef.current = phones;

  useEffect(() => {
    setCompany(deal.company_name);
    setContact(deal.contact_name);
    setSecretaries(deal.secretaries);
    setNotes(deal.notes);
    setKind(deal.next_activity?.kind ?? "ligar");
    setDueLocal(
      deal.next_activity
        ? toDatetimeLocal(deal.next_activity.due_at)
        : defaultNextDueLocal(),
    );
  }, [deal]);

  useEffect(() => {
    setPhones(deal.phones.length > 0 ? deal.phones : [""]);
  }, [deal.id]);

  async function patch(body: Record<string, unknown>) {
    const res = await crmFetch<{ deal: CrmDealCard }>(
      `/api/crm/deals/${deal.id}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    onChange(res.deal);
  }

  async function saveIdentity() {
    try {
      await patch({
        company_name: company.trim() || deal.company_name,
        contact_name: contact.trim(),
        secretaries,
        phones: cleanedPhones(phones).map(formatPhoneDisplay),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou.");
    }
  }

  function queuePhones(next: string[]) {
    phonesRef.current = next;
    setPhones(next);
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(() => {
      void persistPhones(next);
    }, 450);
  }

  async function persistPhones(next: string[]) {
    try {
      await patch({ phones: cleanedPhones(next).map(formatPhoneDisplay) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não salvou o telefone.");
    }
  }

  function flushPhones(next = phonesRef.current) {
    if (phoneTimer.current) {
      clearTimeout(phoneTimer.current);
      phoneTimer.current = null;
    }
    const formatted = next.map((value) =>
      value.trim() ? formatPhoneDisplay(value) : value,
    );
    phonesRef.current = formatted.length > 0 ? formatted : [""];
    setPhones(phonesRef.current);
    void persistPhones(formatted);
  }

  useEffect(() => {
    return () => {
      if (phoneTimer.current) clearTimeout(phoneTimer.current);
    };
  }, []);

  async function schedule() {
    setSaving(true);
    setError(null);
    try {
      const dueAt = fromDatetimeLocal(dueLocal);
      if (!dueAt) throw new Error("Escolha data e horário.");
      const res = await crmFetch<{ deal: CrmDealCard }>(
        `/api/crm/deals/${deal.id}/schedule`,
        { method: "POST", body: JSON.stringify({ kind, dueAt }) },
      );
      onChange(res.deal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não agendou.");
    } finally {
      setSaving(false);
    }
  }

  async function logCall() {
    setSaving(true);
    setError(null);
    try {
      const dueAt = fromDatetimeLocal(dueLocal);
      const res = await crmFetch<{ deal: CrmDealCard }>(
        `/api/crm/deals/${deal.id}/call`,
        {
          method: "POST",
          body: JSON.stringify({
            notes,
            next: dueAt ? { kind, dueAt } : null,
          }),
        },
      );
      onChange(res.deal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não registrou.");
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-podium-navy shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className={CRM_LABEL}>Negócio</p>
            <h2 className="mt-1 text-lg font-extrabold leading-tight">
              {deal.company_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-podium-muted hover:bg-white/5 hover:text-podium-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className={CRM_LABEL}>{COPY.crmCompanyLabel}</span>
            <input
              className={cn(CRM_FIELD, "mt-1.5")}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              onBlur={saveIdentity}
            />
          </label>
          <label className="block">
            <span className={CRM_LABEL}>{COPY.crmContactLabel}</span>
            <input
              className={cn(CRM_FIELD, "mt-1.5")}
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              onBlur={saveIdentity}
              placeholder="Com quem você está falando"
            />
          </label>
          <div>
            <p className={CRM_LABEL}>{COPY.crmSecretaryLabel}</p>
            <div className="mt-1.5 flex flex-col gap-2">
              {secretaries.map((name, index) => (
                <div key={`${name}-${index}`} className="flex gap-2">
                  <input
                    className={CRM_FIELD}
                    value={name}
                    onChange={(event) => {
                      const next = [...secretaries];
                      next[index] = event.target.value;
                      setSecretaries(next);
                    }}
                    onBlur={saveIdentity}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = secretaries.filter((_, i) => i !== index);
                      setSecretaries(next);
                      void patch({ secretaries: next });
                    }}
                    className="rounded-xl px-2 text-podium-muted hover:text-podium-alert"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSecretaries([...secretaries, ""])}
                className="inline-flex items-center gap-1 self-start text-xs text-podium-gray hover:text-podium-yellow"
              >
                <Plus className="h-3.5 w-3.5" />
                {COPY.crmAddSecretary}
              </button>
            </div>
          </div>
          <div>
            <p className={CRM_LABEL}>{COPY.crmPhonesLabel}</p>
            <p className="mt-1 text-[11px] text-podium-muted">
              Digite durante a ligação. Salva sozinho.
            </p>
            <div className="mt-1.5 flex flex-col gap-2">
              {phones.map((phone, index) => (
                <div key={`phone-${index}`} className="flex gap-2">
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={CRM_FIELD}
                    value={phone}
                    maxLength={24}
                    placeholder="(34) 99999-0000"
                    onChange={(event) => {
                      const next = [...phones];
                      next[index] = event.target.value;
                      queuePhones(next);
                    }}
                    onBlur={() => flushPhones()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = phonesRef.current.filter((_, i) => i !== index);
                      const ready = next.length > 0 ? next : [""];
                      phonesRef.current = ready;
                      setPhones(ready);
                      void persistPhones(ready);
                    }}
                    className="rounded-xl px-2 text-podium-muted hover:text-podium-alert"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = [...phonesRef.current, ""];
                  phonesRef.current = next;
                  setPhones(next);
                }}
                className="inline-flex items-center gap-1 self-start text-xs text-podium-gray hover:text-podium-yellow"
              >
                <Plus className="h-3.5 w-3.5" />
                {COPY.crmAddPhone}
              </button>
            </div>
          </div>
          <label className="block">
            <span className={CRM_LABEL}>Considerações da ligação</span>
            <textarea
              className={cn(CRM_FIELD, "mt-1.5 min-h-28 resize-y")}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={COPY.crmNotesPlaceholder}
            />
          </label>
          <div>
            <p className={CRM_LABEL}>{COPY.crmNextAction}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CRM_ACTIVITY_KINDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition",
                    kind === id
                      ? "border-podium-yellow/40 bg-podium-yellow/15 text-podium-yellow"
                      : "border-white/10 bg-white/[0.03] text-podium-gray hover:border-white/20",
                  )}
                >
                  {CRM_ACTIVITY_KIND_LABELS[id]}
                </button>
              ))}
            </div>
            <CrmDateTimePicker value={dueLocal} onChange={setDueLocal} />
            <p className="mt-2 text-[11px] leading-relaxed text-podium-muted">
              Nas duas opções abaixo, a próxima volta entra no card. O amarelo
              também guarda o que foi dito e fecha a volta de agora.
            </p>
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
        <footer className="flex flex-col gap-3 border-t border-white/10 px-5 py-4">
          <div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void logCall()}
              className="w-full rounded-xl bg-podium-yellow py-2.5 text-sm font-extrabold text-podium-navy hover:brightness-110 disabled:opacity-50"
            >
              {COPY.crmLogCall}
            </button>
            <p className="mt-1.5 text-[11px] leading-relaxed text-podium-muted">
              {COPY.crmLogCallHint}
            </p>
          </div>
          <div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void schedule()}
              className="w-full rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow disabled:opacity-50"
            >
              {COPY.crmSchedule}
            </button>
            <p className="mt-1.5 text-[11px] leading-relaxed text-podium-muted">
              {COPY.crmScheduleHint}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void remove()}
            className="text-xs text-podium-muted hover:text-podium-alert"
          >
            Tirar da pista
          </button>
        </footer>
      </aside>
    </div>
  );
}
