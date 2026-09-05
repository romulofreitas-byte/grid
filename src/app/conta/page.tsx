"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnatomyAssembler } from "@/components/AnatomyAssembler";
import { AppShell } from "@/components/AppShell";
import { CargoFields } from "@/components/CargoFields";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { MarketFields } from "@/components/MarketFields";
import { PhotoPicker } from "@/components/PhotoPicker";
import { SectionTitle } from "@/components/SectionTitle";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { COPY } from "@/lib/copy";
import { BACK } from "@/lib/back";
import { formatBrl, getCatalogItem } from "@/lib/billing/catalog";
import { planosHref } from "@/lib/billing/href";
import {
  ledgerReasonLabel,
  ledgerSign,
  orderStatusLabel,
  paymentMethodLabel,
} from "@/lib/billing/labels";
import { BILLING_ME_QUERY_KEY, useBillingMe } from "@/hooks/useBillingMe";
import {
  CALL_GOAL_OPTIONS,
  DEFAULT_CALL_GOAL,
  displayName,
  profileIdentityStatus,
} from "@/lib/pilot-profile";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40";

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

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
        <div className="mt-5 grid min-h-0 flex-1 gap-5 lg:grid-cols-2 lg:grid-rows-1">
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            <GlassCard className={cn("space-y-4 p-4 md:p-5", fillCard)}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
                  Perfil
                </p>
                <p className="mt-1 text-sm text-podium-muted">
                  {profileIdentityStatus(p)}
                </p>
                <Hint className="mt-1">{COPY.contaIdentityHint}</Hint>
              </div>

              <PhotoPicker
                profile={p}
                onUploaded={(next) => qc.setQueryData(["profile"], next)}
              />

              <label className="block text-sm text-podium-gray">
                Como se chama
                <Hint className="mt-0.5">{COPY.comoChama}</Hint>
                <input
                  id="como_chama"
                  defaultValue={p.como_chama ?? ""}
                  onBlur={(e) => save.mutate({ como_chama: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <MarketFields
                especialidade={p.especialidade ?? ""}
                onEspecialidade={(especialidade) =>
                  save.mutate({ especialidade })
                }
                commitText="blur"
              />
              <CargoFields
                cargo={p.cargo ?? ""}
                onCargo={(cargo) => save.mutate({ cargo })}
                commitText="blur"
              />
              <label className="block text-sm text-podium-gray">
                Nome completo
                <input
                  defaultValue={p.nome ?? ""}
                  onBlur={(e) => save.mutate({ nome: e.target.value })}
                  className={fieldClass}
                />
              </label>
            </GlassCard>

            <GlassCard className={cn("space-y-4 p-4 md:p-5", fillCard)}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-muted">
                  {COPY.contaCallSection}
                </p>
                <Hint className="mt-1">{COPY.contaCallHint}</Hint>
              </div>
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
                        "rounded-md border px-3 py-1.5 text-xs font-semibold",
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
              <label className="block scroll-mt-24 rounded-lg border border-podium-yellow/35 bg-podium-yellow/10 p-4 text-sm text-podium-gray">
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
              <div id="meta" className="scroll-mt-24 rounded-lg p-1">
                <p className="text-sm text-podium-gray">Meta de ligações no dia</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CALL_GOAL_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => save.mutate({ meta_ligacoes_dia: n })}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-semibold",
                        (p.meta_ligacoes_dia || DEFAULT_CALL_GOAL) === n
                          ? "border-podium-yellow bg-podium-yellow/15 text-podium-yellow"
                          : "border-white/10 text-podium-gray",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <Link
                  href="/metas"
                  className="mt-3 inline-block text-xs font-semibold text-podium-yellow"
                >
                  {COPY.calculadoraContaLink}
                </Link>
              </div>
              <AnatomyAssembler profile={p} />
              <Hint>{COPY.anatomiaDaLigacao}</Hint>
            </GlassCard>
          </div>

          <div className="flex h-full min-h-0 flex-col gap-4">
            <GlassCard className={cn("shrink-0 p-4", fillCard)} highlight>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
                Cobrança
              </p>
              <p className="mt-2 text-3xl font-semibold text-podium-yellow">
                {(billing?.balance.total ?? p.creditos).toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-sm text-podium-muted">
                {billing?.balance.plan ?? 0} do plano · {billing?.balance.pack ?? 0} de
                recarga
              </p>
              <p className="mt-1 text-balance text-xs text-podium-muted">
                {COPY.contaCreditHint}
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
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={planosHref("/conta")}
                  className="rounded-md bg-podium-yellow px-3 py-1.5 text-xs font-semibold text-podium-navy"
                >
                  Trocar plano / Recarregar
                </Link>
                {billing?.subscription &&
                billing.subscription.status === "active" &&
                !billing.subscription.cancelAtPeriodEnd ? (
                  <button
                    type="button"
                    onClick={() => cancel.mutate()}
                    className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-podium-gray"
                  >
                    Cancelar no fim do ciclo
                  </button>
                ) : null}
              </div>
            </GlassCard>

            <GlassCard className={cn("flex min-h-0 flex-1 flex-col p-4", fillCard)}>
              <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-podium-muted">
                {COPY.contaExtrato}
              </p>
              <p className="mt-1 shrink-0 text-xs text-podium-muted">
                O que entrou e saiu
              </p>
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {(billing?.ledger ?? []).slice(0, 8).length === 0 ? (
                  <p className="text-sm text-podium-muted">
                    {COPY.contaExtratoEmpty}
                  </p>
                ) : (
                  (billing?.ledger ?? []).slice(0, 8).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 text-sm text-podium-gray"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">
                          {ledgerReasonLabel(e.reason)}
                        </span>
                        <span className="text-xs text-podium-muted">
                          {formatDay(e.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {ledgerSign(e.type)}
                        {e.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>

            <GlassCard className={cn("flex min-h-0 flex-1 flex-col p-4", fillCard)}>
              <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-podium-muted">
                Faturas
              </p>
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
                          {item?.nome ?? o.sku} · {paymentMethodLabel(o.method)}
                        </span>
                        <span>
                          {formatBrl(o.amountCents)} · {orderStatusLabel(o.status)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>

            <GlassCard className={cn("shrink-0 p-4", fillCard)}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
                Dúvidas e suporte
              </p>
              <p className="mt-2 text-balance text-sm text-podium-gray">
                Respostas rápidas antes de chamar o atendimento.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href="/duvidas"
                  className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
                >
                  Ver dúvidas
                </Link>
                <SupportWhatsAppButton
                  name={displayName(p)}
                  pathname="/conta"
                  className="px-3 py-1.5 text-xs"
                />
              </div>
            </GlassCard>

            <p className="shrink-0 text-xs text-podium-muted">
              VoIP e Discador ficam em Integrações:{" "}
              <Link href="/integracoes/voip" className="font-semibold text-podium-yellow">
                VoIP
              </Link>
              {" · "}
              <Link href="/integracoes/discador" className="font-semibold text-podium-yellow">
                Discador
              </Link>
              {" · "}
              <Link href="/importacoes" className="font-semibold text-podium-yellow">
                Importações
              </Link>
              {" · "}
              <Link href="/automacoes" className="font-semibold text-podium-yellow">
                Automações
              </Link>
              {" · "}
              <Link
                href={planosHref("/conta")}
                className="font-semibold text-podium-yellow"
              >
                Planos
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
