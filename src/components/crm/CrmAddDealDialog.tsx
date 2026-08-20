"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { COPY } from "@/lib/copy";
import { CRM_FIELD, CRM_LABEL } from "@/lib/crm/client";
import { cn } from "@/lib/utils";

export function CrmAddDealDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    company_name: string;
    contact_name: string;
    secretaries: string[];
  }) => Promise<void>;
}) {
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [secretary, setSecretary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!company.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        company_name: company.trim(),
        contact_name: contact.trim(),
        secretaries: secretary.trim() ? [secretary.trim()] : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não criou o negócio.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-podium-navy p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className={CRM_LABEL}>{COPY.crmAddDeal}</p>
            <h2 className="mt-1 text-lg font-extrabold">Entrada de lista</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-podium-muted hover:text-podium-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className={CRM_LABEL}>{COPY.crmCompanyLabel}</span>
            <input
              className={cn(CRM_FIELD, "mt-1.5")}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              autoFocus
            />
          </label>
          <label className="block">
            <span className={CRM_LABEL}>{COPY.crmContactLabel}</span>
            <input
              className={cn(CRM_FIELD, "mt-1.5")}
              value={contact}
              onChange={(event) => setContact(event.target.value)}
            />
          </label>
          <label className="block">
            <span className={CRM_LABEL}>{COPY.crmSecretaryLabel}</span>
            <input
              className={cn(CRM_FIELD, "mt-1.5")}
              value={secretary}
              onChange={(event) => setSecretary(event.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-podium-yellow py-2.5 text-sm font-extrabold text-podium-navy hover:brightness-110 disabled:opacity-50"
          >
            {COPY.crmAddDeal}
          </button>
        </div>
      </div>
    </div>
  );
}
