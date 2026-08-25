"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnatomyAssembler } from "@/components/AnatomyAssembler";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { PhotoPicker } from "@/components/PhotoPicker";
import { SectionTitle } from "@/components/SectionTitle";
import { BACK } from "@/lib/back";
import { COPY } from "@/lib/copy";
import {
  CALL_GOAL_OPTIONS,
  DEFAULT_CALL_GOAL,
  DEFAULT_MEETING_MINUTES,
  isTratamento,
} from "@/lib/pilot-profile";
import type { Profile, Tratamento } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Capacete", "Pista", "Oferta", "Volta"] as const;

type Draft = {
  como_chama: string;
  tratamento: Tratamento;
  empresa_usuario: string;
  cidade_usuario: string;
  especialidade: string;
  area: string;
  promessa: string;
  duracao_reuniao: number;
  meta_ligacoes_dia: number;
};

function draftFrom(p: Profile): Draft {
  return {
    como_chama: p.como_chama ?? p.nome?.split(/\s+/)[0] ?? "",
    tratamento: isTratamento(p.tratamento) ? p.tratamento : "o",
    empresa_usuario: p.empresa_usuario ?? "",
    cidade_usuario: p.cidade_usuario ?? "",
    especialidade: p.especialidade ?? "",
    area: p.area ?? "",
    promessa: p.promessa ?? "",
    duracao_reuniao: p.duracao_reuniao || DEFAULT_MEETING_MINUTES,
    meta_ligacoes_dia: p.meta_ligacoes_dia || DEFAULT_CALL_GOAL,
  };
}

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40";

export default function SetupPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("profile");
      return (await res.json()) as Profile;
    },
  });

  const profile = profileQuery.data;
  const form = draft ?? (profile ? draftFrom(profile) : null);

  const save = useMutation({
    mutationFn: async (body: Partial<Profile>) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save");
      return (await res.json()) as Profile;
    },
    onSuccess: (p) => {
      qc.setQueryData(["profile"], p);
    },
  });

  const previewProfile = useMemo(() => {
    if (!profile || !form) return null;
    return { ...profile, ...form };
  }, [profile, form]);

  async function persist(extra: Partial<Profile> = {}) {
    if (!form) return false;
    try {
      await save.mutateAsync({ ...form, ...extra });
      return true;
    } catch {
      return false;
    }
  }

  function goToBox() {
    router.push("/box");
    router.refresh();
  }

  async function skip() {
    try {
      await save.mutateAsync({
        onboarding_completed_at: new Date().toISOString(),
      });
      goToBox();
    } catch {
      /* keep on page */
    }
  }

  async function finish() {
    const ok = await persist({ onboarding_completed_at: new Date().toISOString() });
    if (ok) goToBox();
  }

  async function advance() {
    const ok = await persist();
    if (ok) setStep((s) => s + 1);
  }

  const busy = save.isPending;

  if (!profile || !form || !previewProfile) {
    return (
      <AppShell title="Capacete" back={BACK.box}>
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Capacete" back={BACK.box}>
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
          Volta de formação {step + 1}/{STEPS.length}
        </p>
        <SectionTitle className="mt-2">Monte o capacete</SectionTitle>
        <Hint className="mt-2">
          Esses dados entram como quem você é na ligação. Pular deixa a identidade genérica.
        </Hint>

        <div className="mt-5 flex gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={cn(
                  "h-1 rounded-full",
                  i <= step ? "bg-podium-yellow" : "bg-white/10",
                )}
              />
              <p className="mt-1 hidden text-[10px] uppercase tracking-wider text-podium-muted sm:block">
                {label}
              </p>
            </div>
          ))}
        </div>

        <GlassCard className="mt-6 space-y-5 p-5" highlight>
          {step === 0 ? (
            <>
              <PhotoPicker
                profile={profile}
                onUploaded={(p) => qc.setQueryData(["profile"], p)}
              />
              <label className="block text-sm text-podium-gray">
                Como você se chama na ligação
                <Hint className="mt-0.5">{COPY.comoChama}</Hint>
                <input
                  id="como_chama"
                  value={form.como_chama}
                  onChange={(e) =>
                    setDraft({ ...form, como_chama: e.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <fieldset id="tratamento">
                <legend className="text-sm text-podium-gray">
                  Aqui é…
                  <Hint className="mt-0.5">{COPY.tratamento}</Hint>
                </legend>
                <div className="mt-2 flex gap-2">
                  {(["o", "a", "e"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraft({ ...form, tratamento: t })}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-sm font-bold",
                        form.tratamento === t
                          ? "border-podium-yellow bg-podium-yellow/15 text-podium-yellow"
                          : "border-white/10 text-podium-gray",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <label className="block text-sm text-podium-gray">
                Empresa
                <input
                  id="empresa_usuario"
                  value={form.empresa_usuario}
                  onChange={(e) =>
                    setDraft({ ...form, empresa_usuario: e.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-podium-gray">
                Cidade
                <input
                  id="cidade_usuario"
                  value={form.cidade_usuario}
                  onChange={(e) =>
                    setDraft({ ...form, cidade_usuario: e.target.value })
                  }
                  className={fieldClass}
                />
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <label className="block text-sm text-podium-gray">
                Especialidade
                <Hint className="mt-0.5">{COPY.especialidade}</Hint>
                <input
                  value={form.especialidade}
                  onChange={(e) =>
                    setDraft({ ...form, especialidade: e.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-podium-gray">
                Área
                <Hint className="mt-0.5">{COPY.area}</Hint>
                <input
                  value={form.area}
                  onChange={(e) => setDraft({ ...form, area: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="block rounded-2xl border border-podium-yellow/35 bg-podium-yellow/10 p-4 text-sm text-podium-gray">
                A promessa do piloto
                <Hint className="mt-0.5">{COPY.promessaCompromisso}</Hint>
                <textarea
                  id="promessa"
                  rows={3}
                  value={form.promessa}
                  onChange={(e) =>
                    setDraft({ ...form, promessa: e.target.value })
                  }
                  className={cn(
                    fieldClass,
                    "resize-none border-podium-yellow/30 bg-podium-navy/40 text-podium-white focus:border-podium-yellow/60",
                  )}
                />
              </label>
              <label className="block text-sm text-podium-gray">
                Duração da reunião (minutos)
                <input
                  id="duracao_reuniao"
                  type="number"
                  min={5}
                  max={120}
                  value={form.duracao_reuniao}
                  onChange={(e) =>
                    setDraft({
                      ...form,
                      duracao_reuniao: Number(e.target.value),
                    })
                  }
                  className={fieldClass}
                />
              </label>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="text-sm text-podium-gray">Meta de ligações no dia</p>
              <div className="flex flex-wrap gap-2">
                {CALL_GOAL_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDraft({ ...form, meta_ligacoes_dia: n })}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-bold",
                      form.meta_ligacoes_dia === n
                        ? "border-podium-yellow bg-podium-yellow/15 text-podium-yellow"
                        : "border-white/10 text-podium-gray",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-sm text-podium-white">
                Roteiro pronto. O Box passa a cobrar a volta — ligar, não só
                montar lista.
              </p>
            </>
          ) : null}

          <AnatomyAssembler profile={previewProfile} step={step} />
        </GlassCard>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void skip()}
            className="text-sm text-podium-muted hover:text-podium-white disabled:opacity-40"
          >
            {busy ? "Salvando…" : "Pular por agora"}
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-podium-gray disabled:opacity-40"
              >
                Voltar
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void advance()}
                className="rounded-xl bg-podium-yellow px-5 py-2 text-sm font-extrabold text-podium-navy disabled:opacity-40"
              >
                {busy ? "Salvando…" : "Continuar"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish()}
                className="rounded-xl bg-podium-yellow px-5 py-2 text-sm font-extrabold text-podium-navy disabled:opacity-40"
              >
                {busy ? "Salvando…" : "Ir para o Box"}
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
