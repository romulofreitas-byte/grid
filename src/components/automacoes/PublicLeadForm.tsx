"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import type { CrmFormFields, CrmLeadKind } from "@/lib/crm/types";

const INPUT =
  "mt-1 w-full rounded-md border border-white/15 bg-podium-panel px-3 py-2 text-sm text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

export function PublicLeadForm({
  token,
  nome,
  leadKind,
  fields,
}: {
  token: string;
  nome: string;
  leadKind: CrmLeadKind;
  fields: CrmFormFields;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/forms/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        email,
        company: fields.company ? company : undefined,
        cnpj: fields.cnpj ? cnpj : undefined,
        empresa_website: honeypot,
        ...answers,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Não foi possível enviar.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm text-podium-gray">{COPY.publicFormThanks}</p>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <p className="text-sm font-semibold text-podium-white">{nome}</p>
      <label className="block text-xs text-podium-gray">
        Nome
        <input
          required
          className={INPUT}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </label>
      <label className="block text-xs text-podium-gray">
        Telefone
        <input
          required
          className={INPUT}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
      </label>
      <label className="block text-xs text-podium-gray">
        E-mail
        <input
          type="email"
          className={INPUT}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      {leadKind === "company" || fields.company ? (
        <label className="block text-xs text-podium-gray">
          Empresa
          <input
            className={INPUT}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
      ) : null}
      {fields.cnpj ? (
        <label className="block text-xs text-podium-gray">
          CNPJ
          <input
            className={INPUT}
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
          />
        </label>
      ) : null}
      {(fields.questions ?? []).map((question) => (
        <label key={question.id} className="block text-xs text-podium-gray">
          {question.label}
          <input
            className={INPUT}
            value={answers[question.id] ?? ""}
            onChange={(e) =>
              setAnswers((current) => ({ ...current, [question.id]: e.target.value }))
            }
          />
        </label>
      ))}
      <div className="hidden" aria-hidden="true">
        <input
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-podium-yellow">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={busy} className="w-full">
        {busy ? "Enviando…" : COPY.publicFormSubmit}
      </Button>
    </form>
  );
}
