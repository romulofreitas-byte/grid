"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CargoFields } from "@/components/CargoFields";
import { MarketFields } from "@/components/MarketFields";
import { SetupIdentityCard } from "@/components/SetupIdentityCard";
import { SetupStage } from "@/components/SetupStage";
import { Button } from "@/components/ui/Button";
import { largadaNovaHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
import {
  cargoChoice,
  hasSetupIdentity,
  marketChoice,
  setupEcho,
} from "@/lib/pilot-profile";
import type { Profile } from "@/lib/types";

const TOTAL_STEPS = 4;

type Draft = {
  como_chama: string;
  especialidade: string;
  cargo: string;
};

function draftFrom(p: Profile): Draft {
  return {
    como_chama: p.como_chama ?? p.nome?.split(/\s+/)[0] ?? "",
    especialidade: persistChoice(p.especialidade ?? "", marketChoice(p.especialidade)),
    cargo: persistChoice(p.cargo ?? "", cargoChoice(p.cargo)),
  };
}

function persistChoice(value: string, selectedId: string | null): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!selectedId || selectedId === "outro") return trimmed === "outro" ? "outro" : trimmed;
  return selectedId;
}

function pulseStage(step: number) {
  return (
    <SetupStage
      step={step}
      total={TOTAL_STEPS}
      footer={<div className="h-9 w-28 animate-pulse rounded-md bg-white/5" />}
    >
      <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
    </SetupStage>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);

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

  const identityOk = form
    ? hasSetupIdentity({
        como_chama: form.como_chama,
        nome: profile?.nome ?? null,
        especialidade: form.especialidade,
        cargo: form.cargo,
      })
    : false;

  const nameOk = Boolean(form?.como_chama.trim());
  const marketOk = Boolean(
    form && form.especialidade.trim() && form.especialidade.trim() !== "outro",
  );
  const cargoOk = Boolean(form && form.cargo.trim() && form.cargo.trim() !== "outro");
  const echo =
    form && nameOk
      ? setupEcho({
          como_chama: form.como_chama,
          nome: profile?.nome ?? null,
          especialidade: marketOk ? form.especialidade : null,
          cargo: cargoOk ? form.cargo : null,
        })
      : "";

  async function persistStep(patch: Partial<Profile>) {
    await save.mutateAsync(patch);
  }

  async function goNext() {
    if (!form) return;
    try {
      if (step === 1) {
        if (!nameOk) return;
        await persistStep({ como_chama: form.como_chama.trim() });
        setStep(2);
        return;
      }
      if (step === 2) {
        if (!marketOk) return;
        await persistStep({
          especialidade: persistChoice(
            form.especialidade,
            marketChoice(form.especialidade),
          ),
        });
        setStep(3);
        return;
      }
      if (step === 3) {
        if (!cargoOk) return;
        await persistStep({
          cargo: persistChoice(form.cargo, cargoChoice(form.cargo)),
        });
        setStep(4);
      }
    } catch {
      /* keep the step */
    }
  }

  async function finish() {
    if (!form || !identityOk) return;
    try {
      await save.mutateAsync({
        como_chama: form.como_chama.trim(),
        especialidade: persistChoice(
          form.especialidade,
          marketChoice(form.especialidade),
        ),
        cargo: persistChoice(form.cargo, cargoChoice(form.cargo)),
        onboarding_completed_at: new Date().toISOString(),
      });
      router.push(largadaNovaHref);
      router.refresh();
    } catch {
      /* keep the form */
    }
  }

  const busy = save.isPending;

  if (!profile || !form) return pulseStage(1);
  if (profile.onboarding_completed_at) return pulseStage(1);

  const needCopy =
    step === 1 && !nameOk
      ? COPY.setupNeedName
      : step === 2 && !marketOk
        ? COPY.setupNeedMarket
        : step === 3 && !cargoOk
          ? COPY.setupNeedCargo
          : null;

  const canAdvance =
    (step === 1 && nameOk) ||
    (step === 2 && marketOk) ||
    (step === 3 && cargoOk) ||
    (step === 4 && identityOk);

  return (
    <SetupStage
      step={step}
      total={TOTAL_STEPS}
      center={step === 1 || step === 4}
      footer={
        <div className="flex w-full flex-col items-stretch gap-2">
          {needCopy ? (
            <p className="text-right text-xs text-podium-muted">{needCopy}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {step > 1 ? (
              <Button
                variant="ghost"
                size="lg"
                className="mr-auto"
                disabled={busy}
                onClick={() => setStep((current) => Math.max(1, current - 1))}
              >
                {COPY.setupBack}
              </Button>
            ) : null}
            {step < 4 ? (
              <Button
                variant="primary"
                size="lg"
                disabled={busy || !canAdvance}
                onClick={() => void goNext()}
              >
                {busy ? "Salvando…" : COPY.setupContinue}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                disabled={busy || !identityOk}
                onClick={() => void finish()}
              >
                {busy ? "Salvando…" : COPY.setupCta}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {step === 1 ? (
        <label className="block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
            {COPY.setupIdentityTitle}
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight md:text-5xl">
            {COPY.setupStepName}
          </h1>
          <p className="mt-3 text-sm text-podium-muted">{COPY.setupIdentityHint}</p>
          <input
            id="como_chama"
            autoFocus
            value={form.como_chama}
            onChange={(e) => setDraft({ ...form, como_chama: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void goNext();
              }
            }}
            className="mt-10 w-full border-b border-white/20 bg-transparent pb-3 text-2xl font-semibold outline-none focus:border-podium-yellow/60 md:text-4xl"
          />
        </label>
      ) : null}

      {step === 2 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">
            {COPY.setupStepMarket}
          </h1>
          <div className="mt-4 min-h-0 flex-1 md:mt-6">
            <MarketFields
              legend={false}
              variant="setup"
              especialidade={form.especialidade}
              onEspecialidade={(especialidade) =>
                setDraft({ ...form, especialidade })
              }
            />
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">
            {COPY.setupStepCargo}
          </h1>
          {echo ? (
            <p className="mt-2 text-sm font-medium text-podium-yellow md:mt-3 md:text-base">
              {echo}
            </p>
          ) : null}
          <div className="mt-3 min-h-0 flex-1 md:mt-5">
            <CargoFields
              legend={false}
              variant="setup"
              cargo={form.cargo}
              onCargo={(cargo) => setDraft({ ...form, cargo })}
            />
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <SetupIdentityCard
          profile={{ ...profile, ...form }}
          echo={echo}
          nameOn={nameOk}
          marketOn={marketOk}
          cargoOn={cargoOk}
          onUploaded={(next) => qc.setQueryData(["profile"], next)}
        />
      ) : null}
    </SetupStage>
  );
}
