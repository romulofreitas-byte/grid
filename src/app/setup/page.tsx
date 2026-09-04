"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnatomyAssembler } from "@/components/AnatomyAssembler";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import {
  SetupFirstGrid,
  type FirstGridNiche,
} from "@/components/SetupFirstGrid";
import { BACK, gridHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
import {
  DEFAULT_MEETING_MINUTES,
  hasScriptIdentity,
  isTratamento,
} from "@/lib/pilot-profile";
import type { Profile, Search, Tratamento } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Quem liga", "Primeira lista"] as const;

type Draft = {
  como_chama: string;
  tratamento: Tratamento;
  empresa_usuario: string;
  cidade_usuario: string;
  promessa: string;
  duracao_reuniao: number;
};

function draftFrom(p: Profile): Draft {
  return {
    como_chama: p.como_chama ?? p.nome?.split(/\s+/)[0] ?? "",
    tratamento: isTratamento(p.tratamento) ? p.tratamento : "o",
    empresa_usuario: p.empresa_usuario ?? "",
    cidade_usuario: p.cidade_usuario ?? "",
    promessa: p.promessa ?? "",
    duracao_reuniao: p.duracao_reuniao || DEFAULT_MEETING_MINUTES,
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

  useEffect(() => {
    if (profile?.onboarding_completed_at) {
      router.replace("/painel");
    }
  }, [profile?.onboarding_completed_at, router]);

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

  const identityOk = form
    ? hasScriptIdentity({
        como_chama: form.como_chama,
        nome: profile?.nome ?? null,
        empresa_usuario: form.empresa_usuario,
        cidade_usuario: form.cidade_usuario,
        promessa: form.promessa,
      })
    : false;

  async function advance() {
    if (!identityOk) return;
    const ok = await persist();
    if (ok) setStep(1);
  }

  async function finishFirstList(search: Search, niche: FirstGridNiche) {
    const ok = await persist({
      especialidade: niche.segmentNome,
      area: niche.parentNome,
      onboarding_completed_at: new Date().toISOString(),
    });
    if (!ok) throw new Error("Não foi possível guardar o perfil");
    router.push(gridHref(search.id, "box"));
    router.refresh();
  }

  const busy = save.isPending;

  if (!profile || !form || !previewProfile) {
    return (
      <AppShell title="Começar" back={BACK.painel}>
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      </AppShell>
    );
  }

  if (profile.onboarding_completed_at) {
    return (
      <AppShell title="Começar" back={BACK.painel}>
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Começar" back={BACK.painel}>
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
          Passo {step + 1}/{STEPS.length}
        </p>
        <SectionTitle className="mt-2">
          {step === 0 ? COPY.setupIdentityTitle : COPY.setupGridTitle}
        </SectionTitle>
        <Hint className="mt-2">
          {step === 0 ? COPY.setupIdentityHint : COPY.setupGridHint}
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

        {step === 0 ? (
          <>
            <GlassCard className="mt-6 space-y-5 p-5" highlight>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-podium-gray sm:col-span-2">
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
                <fieldset id="tratamento" className="sm:col-span-2">
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
              </div>
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
              <AnatomyAssembler profile={previewProfile} />
            </GlassCard>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                disabled={busy || !identityOk}
                onClick={() => void advance()}
                className="rounded-xl bg-podium-yellow px-5 py-2 text-sm font-extrabold text-podium-navy disabled:opacity-40"
              >
                {busy ? "Salvando…" : COPY.setupContinue}
              </button>
            </div>
            {!identityOk ? (
              <p className="mt-3 text-right text-xs text-podium-muted">
                {COPY.setupNeedIdentity}
              </p>
            ) : null}
          </>
        ) : (
          <div className="mt-6">
            <SetupFirstGrid
              cidadeUsuario={form.cidade_usuario}
              onBack={() => setStep(0)}
              onReady={finishFirstList}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
