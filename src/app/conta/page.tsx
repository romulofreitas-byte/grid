"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnatomyAssembler } from "@/components/AnatomyAssembler";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { PhotoPicker } from "@/components/PhotoPicker";
import { SectionTitle } from "@/components/SectionTitle";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { COPY } from "@/lib/copy";
import { BACK } from "@/lib/back";
import { formatBrl, getCatalogItem } from "@/lib/billing/catalog";
import { planosHref } from "@/lib/billing/href";
import { BILLING_ME_QUERY_KEY, useBillingMe } from "@/hooks/useBillingMe";
import {
  CALL_GOAL_OPTIONS,
  DEFAULT_CALL_GOAL,
  displayName,
  isTratamento,
  profileReadiness,
} from "@/lib/pilot-profile";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40";

export default function ContaPage() {
  const qc = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      return (await res.json()) as Profile;
    },
  });

  const billingQuery = useBillingMe();

  const save = useMutation({
    mutationFn: async (body: Partial<Profile>) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return (await res.json()) as Profile;
    },
    onSuccess: (p) => qc.setQueryData(["profile"], p),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível cancelar");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLING_ME_QUERY_KEY }),
  });

  const p = profileQuery.data;
  const billing = billingQuery.data;
  const ready = p ? profileReadiness(p) : 0;

  useEffect(() => {
    if (!p) return;
    const hash = window.location.hash.slice(1);
    if (hash !== "promessa" && hash !== "meta") return;
    const el = document.getElementById(hash);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("audit-gap-pulse");
    const timer = window.setTimeout(() => {
      el.classList.remove("audit-gap-pulse");
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [p?.id]);

  const fillCard = "hover:translate-y-0";

  return (
    <AppShell fill title="Conta" back={BACK.painel}>
      <SectionTitle className="shrink-0">Conta</SectionTitle>
      {!p ? (
        <div className="mt-6 min-h-0 flex-1 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <div className="mt-6 grid min-h-0 flex-1 gap-6 lg:grid-cols-2 lg:grid-rows-1">
          <GlassCard className={cn("flex h-full flex-col space-y-4 p-6 md:p-8", fillCard)}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
                Perfil
              </p>
              <p className="mt-1 text-sm text-podium-muted">
                {ready}% pronto · entra no briefing da ligação
              </p>
            </div>

            <PhotoPicker
              profile={p}
              onUploaded={(next) => qc.setQueryData(["profile"], next)}
            />

            <div className="flex flex-wrap gap-2">
              <Link
                href="/conexoes"
                className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
              >
                Conexões
              </Link>
              <Link
                href={planosHref("/conta")}
                className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
              >
                Planos
              </Link>
              <Link
                href="/admin/nichos"
                className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-muted hover:border-white/20 hover:text-podium-white"
              >
                Admin
              </Link>
            </div>

            <label className="block text-sm text-podium-gray">
              Nome completo
              <input
                defaultValue={p.nome ?? ""}
                onBlur={(e) => save.mutate({ nome: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm text-podium-gray">
              Como se chama na ligação
              <Hint className="mt-0.5">{COPY.comoChama}</Hint>
              <input
                id="como_chama"
                defaultValue={p.como_chama ?? ""}
                onBlur={(e) => save.mutate({ como_chama: e.target.value })}
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
                    onClick={() => save.mutate({ tratamento: t })}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-bold",
                      (p.tratamento ?? "o") === t
                        ? "border-podium-yellow bg-podium-yellow/15 text-podium-yellow"
                        : "border-white/10 text-podium-gray",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
            {(
              [
                ["empresa_usuario", "Empresa", null],
                ["cidade_usuario", "Cidade", null],
                ["especialidade", "Especialidade", COPY.especialidade],
                ["area", "Área", COPY.area],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="block text-sm text-podium-gray">
                {label}
                {hint ? <Hint className="mt-0.5">{hint}</Hint> : null}
                <input
                  id={key}
                  defaultValue={p[key] ?? ""}
                  onBlur={(e) => save.mutate({ [key]: e.target.value })}
                  className={fieldClass}
                />
              </label>
            ))}
            <label className="block scroll-mt-24 rounded-2xl border border-podium-yellow/35 bg-podium-yellow/10 p-4 text-sm text-podium-gray">
              A promessa do piloto
              <Hint className="mt-0.5">{COPY.promessaCompromisso}</Hint>
              <textarea
                id="promessa"
                rows={3}
                defaultValue={p.promessa ?? ""}
                onBlur={(e) => save.mutate({ promessa: e.target.value })}
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
                defaultValue={p.duracao_reuniao}
                onBlur={(e) =>
                  save.mutate({ duracao_reuniao: Number(e.target.value) })
                }
                className={fieldClass}
              />
            </label>
            <div id="meta" className="scroll-mt-24 rounded-xl p-1">
              <p className="text-sm text-podium-gray">Meta de ligações no dia</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CALL_GOAL_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => save.mutate({ meta_ligacoes_dia: n })}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-bold",
                      (p.meta_ligacoes_dia || DEFAULT_CALL_GOAL) === n
                        ? "border-podium-yellow bg-podium-yellow/15 text-podium-yellow"
                        : "border-white/10 text-podium-gray",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <AnatomyAssembler profile={p} />
            <Hint>{COPY.anatomiaDaLigacao}</Hint>
            <p className="pt-2 text-sm text-podium-muted">
              Discador, VOIP e CRM ficam em{" "}
              <Link href="/conexoes" className="font-bold text-podium-yellow">
                Conexões
              </Link>
              .
            </p>
          </GlassCard>

          <div className="flex h-full min-h-0 flex-col gap-4">
            <GlassCard className={cn("shrink-0 p-6", fillCard)} highlight>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
                Cobrança
              </p>
              <p className="mt-3 text-4xl font-extrabold text-podium-yellow md:text-5xl">
                {(billing?.balance.total ?? p.creditos).toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-sm text-podium-muted">
                {billing?.balance.plan ?? 0} do plano · {billing?.balance.pack ?? 0} de
                recarga
              </p>
              <p className="mt-1 text-balance text-xs text-podium-muted">
                O crédito do plano zera no mês. Recarga fica e não reabre o
                {"\u00a0"}CRM.
              </p>
              {billing?.balance.trialExpired ? (
                <p className="mt-2 text-xs text-podium-yellow">
                  Os 30 dias acabaram. Assine o Piloto para continuar.
                </p>
              ) : billing?.subscription?.status === "trialing" &&
                billing.balance.trialDaysLeft != null ? (
                <p className="mt-2 text-xs text-podium-yellow">
                  Restam {billing.balance.trialDaysLeft}{" "}
                  {billing.balance.trialDaysLeft === 1 ? "dia" : "dias"} do trial
                  Mundo Pódium.
                </p>
              ) : null}
              {billing?.subscription?.cancelAtPeriodEnd ? (
                <p className="mt-2 text-xs text-podium-yellow">
                  Cancela no fim do ciclo.
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={planosHref("/conta")}
                  className="rounded-xl bg-podium-yellow px-4 py-2.5 text-xs font-extrabold text-podium-navy"
                >
                  Trocar plano / Recarregar
                </Link>
                {billing?.subscription &&
                billing.subscription.status === "active" &&
                !billing.subscription.cancelAtPeriodEnd ? (
                  <button
                    type="button"
                    onClick={() => cancel.mutate()}
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-podium-gray"
                  >
                    Cancelar no fim do ciclo
                  </button>
                ) : null}
              </div>
            </GlassCard>

            <GlassCard className={cn("flex min-h-0 flex-1 flex-col p-6", fillCard)}>
              <p className="shrink-0 text-sm font-bold">Faturas</p>
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {(billing?.orders ?? []).slice(0, 8).length === 0 ? (
                  <p className="text-sm text-podium-muted">Nenhuma fatura ainda.</p>
                ) : (
                  (billing?.orders ?? []).slice(0, 8).map((o) => {
                    const item = getCatalogItem(o.sku);
                    return (
                      <div
                        key={o.id}
                        className="flex items-center justify-between gap-2 text-sm text-podium-gray"
                      >
                        <span>
                          {item?.nome ?? o.sku} · {o.method}
                        </span>
                        <span>
                          {formatBrl(o.amountCents)} · {o.status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>

            <GlassCard className={cn("flex min-h-0 flex-1 flex-col p-6", fillCard)}>
              <p className="shrink-0 text-sm font-bold">Últimos créditos</p>
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {(billing?.ledger ?? []).slice(0, 8).length === 0 ? (
                  <p className="text-sm text-podium-muted">Sem movimentos.</p>
                ) : (
                  (billing?.ledger ?? []).slice(0, 8).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between text-sm text-podium-gray"
                    >
                      <span>{e.reason}</span>
                      <span>
                        {e.type === "debit" ? "−" : "+"}
                        {e.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>

            <GlassCard className={cn("shrink-0 p-6", fillCard)}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
                Dúvidas e suporte
              </p>
              <p className="mt-2 text-balance text-sm text-podium-gray">
                Respostas rápidas antes de chamar o atendimento.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href="/duvidas"
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
                >
                  Ver dúvidas
                </Link>
                <SupportWhatsAppButton
                  name={displayName(p)}
                  pathname="/conta"
                  className="px-4 py-2.5 text-xs"
                />
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </AppShell>
  );
}
