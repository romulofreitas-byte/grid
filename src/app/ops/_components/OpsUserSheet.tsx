"use client";

import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { PilotAvatar } from "@/components/PilotAvatar";
import { SectionTitle } from "@/components/SectionTitle";
import { Button } from "@/components/ui/Button";
import {
  cohortLabel,
  formatBrl,
  formatDay,
  formatInt,
  lotSourceLabel,
  planLabel,
} from "@/app/ops/_components/format";
import { creditsPhrase, getCatalogItem } from "@/lib/billing/catalog";
import {
  ledgerReasonLabel,
  ledgerSign,
  orderStatusLabel,
} from "@/lib/billing/labels";
import type { OpsUserDetail } from "@/lib/ops/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const CREDIT_PRESETS = [25, 50, 100, 250, 500] as const;
const CREDIT_STEP = 25;

type ConfirmKind =
  | null
  | "credits"
  | "credits-revoke"
  | "cancel"
  | "trial"
  | "trial-force"
  | "plan-piloto"
  | "plan-pro";

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (res.status === 401) {
    throw Object.assign(new Error("auth"), { code: "auth" });
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Falha");
  }
  return data;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function UsageMeter({
  label,
  value,
  max,
  reduce,
}: {
  label: string;
  value: number;
  max: number;
  reduce: boolean | null;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(value > 0 ? 6 : 0, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-podium-muted">{label}</span>
        <span className="font-semibold tabular-nums">{formatInt(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-podium-yellow"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

export function OpsUserSheet({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const [qty, setQty] = useState("100");
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevCredits = useRef<number | null>(null);

  const query = useQuery({
    queryKey: ["ops-user", id],
    queryFn: async () => {
      const res = await fetch(`/api/ops/users/${id}`);
      return readJson<OpsUserDetail>(res);
    },
  });

  useEffect(() => {
    if (
      query.error &&
      query.error instanceof Error &&
      "code" in query.error &&
      query.error.code === "auth"
    ) {
      router.replace("/ops/entrar");
    }
  }, [query.error, router]);

  const u = query.data;
  useEffect(() => {
    if (!u) return;
    if (prevCredits.current === null) {
      prevCredits.current = u.credits;
      return;
    }
    if (prevCredits.current === u.credits) return;
    setFlash(u.credits > prevCredits.current ? "up" : "down");
    prevCredits.current = u.credits;
    const t = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(t);
  }, [u]);

  const act = useMutation({
    mutationFn: async (input: {
      path: string;
      body?: Record<string, unknown>;
    }) => {
      const res = await fetch(input.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.body ?? {}),
      });
      return readJson<OpsUserDetail>(res);
    },
    onSuccess: (user) => {
      qc.setQueryData(["ops-user", id], user);
      void qc.invalidateQueries({ queryKey: ["ops-metrics"] });
      void qc.invalidateQueries({ queryKey: ["ops-users"] });
      setConfirm(null);
      setActionError(null);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Falha");
    },
  });

  const creditsQty = Number.parseInt(qty, 10);
  const qtyOk = Number.isFinite(creditsQty) && creditsQty >= 1 && creditsQty <= 50000;
  const preview =
    u && qtyOk
      ? confirm === "credits-revoke"
        ? Math.max(0, u.credits - creditsQty)
        : u.credits + creditsQty
      : null;
  const usageMax = useMemo(() => {
    if (!u) return 1;
    return Math.max(u.usage.searches, u.usage.enrich, u.usage.calls, u.usage.savedLeads, 1);
  }, [u]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/ops?tab=conta"
        className="text-sm font-semibold text-podium-muted hover:text-podium-white"
      >
        Voltar ao Ops
      </Link>

      {query.error && query.error.message !== "auth" ? (
        <p className="text-sm text-podium-alert">{query.error.message}</p>
      ) : null}

      {!u && query.isLoading ? (
        <p className="text-sm text-podium-muted">Carregando ficha…</p>
      ) : null}

      {u ? (
        <>
          <div className="flex items-center gap-3">
            <PilotAvatar
              profile={{
                foto_url: u.fotoUrl,
                como_chama: u.nome,
                nome: u.nome,
              }}
              size="md"
              shape="squircle"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {u.nome || "Sem nome"}
              </h1>
              <p className="mt-0.5 truncate text-sm text-podium-muted">
                {u.email || "sem e-mail"}
                {u.empresa ? ` · ${u.empresa}` : ""}
                {u.cidade ? ` · ${u.cidade}` : ""}
              </p>
            </div>
          </div>

          <GlassCard className="divide-y divide-white/10 p-0" hover={false}>
            {(
              [
                {
                  id: "ops-plan",
                  label: "Plano",
                  value: planLabel(u.plan),
                  hint: `${cohortLabel(u.cohort)}${u.cancelAtPeriodEnd ? " · cancela no fim" : ""}`,
                },
                {
                  id: "ops-credits",
                  label: "Créditos",
                  value: formatInt(u.credits),
                  hint: `plano ${formatInt(u.balance.plan)} · pack ${formatInt(u.balance.pack)}`,
                },
                {
                  id: "ops-history",
                  label: "LTV",
                  value: formatBrl(u.ltvCents),
                  hint: "Soma dos pedidos pagos",
                },
                {
                  id: "ops-usage",
                  label: "Ativação",
                  value: u.activated ? "Sim" : "Não",
                  hint: `Setup ${formatDay(u.onboardingCompletedAt)} · cadastro ${formatDay(u.createdAt)}`,
                },
              ] as const
            ).map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={() => scrollToSection(row.id)}
                className="flex w-full items-baseline justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <span>
                  <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                    {row.label}
                  </span>
                  <Hint className="mt-0.5">{row.hint}</Hint>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    row.label === "Créditos" && flash === "up" && "text-podium-yellow",
                    row.label === "Créditos" && flash === "down" && "text-podium-alert",
                  )}
                >
                  {row.value}
                </span>
              </button>
            ))}
          </GlassCard>

          <GlassCard id="ops-usage" className="space-y-3 p-4" hover={false}>
            <SectionTitle>Uso</SectionTitle>
            <UsageMeter label="Buscas" value={u.usage.searches} max={usageMax} reduce={reduce} />
            <UsageMeter label="Qualificações" value={u.usage.enrich} max={usageMax} reduce={reduce} />
            <UsageMeter label="Ligações" value={u.usage.calls} max={usageMax} reduce={reduce} />
            <UsageMeter
              label="Leads salvos"
              value={u.usage.savedLeads}
              max={usageMax}
              reduce={reduce}
            />
          </GlassCard>

          <GlassCard id="ops-credits" className="space-y-4 p-4" hover={false}>
            <SectionTitle>Créditos</SectionTitle>
            {actionError && (confirm === "credits" || confirm === "credits-revoke" || !confirm) ? (
              <p className="text-sm text-podium-alert">{actionError}</p>
            ) : null}

            <div className="rounded-md border border-white/10 bg-black/20 px-4 py-4 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                Saldo agora
              </p>
              <p
                className={cn(
                  "mt-1 text-4xl font-semibold tabular-nums tracking-tight",
                  flash === "up" && "text-podium-yellow",
                  flash === "down" && "text-podium-alert",
                )}
              >
                {formatInt(u.credits)}
              </p>
              <Hint className="mt-1">
                Plano {formatInt(u.balance.plan)} · recarga {formatInt(u.balance.pack)}
              </Hint>
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                Quanto ajustar
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CREDIT_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setQty(String(n));
                      setActionError(null);
                    }}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition",
                      Number(qty) === n
                        ? "border-podium-yellow/50 bg-podium-yellow/15 text-podium-yellow"
                        : "border-white/10 bg-white/[0.04] text-podium-gray hover:border-white/20 hover:text-podium-white",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  aria-label="Diminuir"
                  onClick={() =>
                    setQty(String(Math.max(1, (Number.isFinite(creditsQty) ? creditsQty : 0) - CREDIT_STEP)))
                  }
                >
                  −
                </Button>
                <input
                  className="h-8 w-24 rounded-md border border-white/10 bg-podium-panel px-2.5 text-center text-xs tabular-nums text-podium-white outline-none focus:border-podium-yellow/40"
                  type="number"
                  min={1}
                  max={50000}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  aria-label="Aumentar"
                  onClick={() =>
                    setQty(
                      String(
                        Math.min(50000, (Number.isFinite(creditsQty) ? creditsQty : 0) + CREDIT_STEP),
                      ),
                    )
                  }
                >
                  +
                </Button>
                <Hint className="min-w-0">{creditsPhrase(qtyOk ? creditsQty : 0)}</Hint>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {preview !== null && (confirm === "credits" || confirm === "credits-revoke") ? (
                <motion.div
                  key={confirm}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -4 }}
                  className="rounded-md border border-podium-yellow/25 bg-podium-yellow/10 px-3 py-3"
                >
                  <p className="text-sm font-semibold text-podium-white">
                    {formatInt(u.credits)} → {formatInt(preview)}
                  </p>
                  <Hint className="mt-1">
                    {confirm === "credits-revoke"
                      ? `Retirar ${creditsPhrase(creditsQty)}. O saldo não fica negativo.`
                      : `Dar ${creditsPhrase(creditsQty)} de cortesia.`}
                  </Hint>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate({
                          path: `/api/ops/users/${id}/credits`,
                          body: {
                            qty: creditsQty,
                            action: confirm === "credits-revoke" ? "revoke" : "grant",
                          },
                        })
                      }
                    >
                      {act.isPending
                        ? "Aplicando…"
                        : confirm === "credits-revoke"
                          ? "Confirmar retirada"
                          : "Confirmar créditos"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => setConfirm(null)}
                    >
                      Voltar
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="credit-actions"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-wrap gap-2"
                >
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={!qtyOk}
                    onClick={() => {
                      setActionError(null);
                      setConfirm("credits");
                    }}
                  >
                    Dar créditos
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={!qtyOk}
                    onClick={() => {
                      setActionError(null);
                      setConfirm("credits-revoke");
                    }}
                  >
                    Retirar créditos
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          <GlassCard id="ops-plan" className="space-y-3 p-4" hover={false}>
            <SectionTitle>Plano</SectionTitle>
            {actionError &&
            confirm !== "credits" &&
            confirm !== "credits-revoke" ? (
              <p className="text-sm text-podium-alert">{actionError}</p>
            ) : null}
            <p className="text-sm text-podium-gray">
              Agora: <span className="font-semibold text-podium-white">{planLabel(u.plan)}</span>
              {u.cancelAtPeriodEnd ? " · cancela no fim do período" : ""}
            </p>
            {u.platformTrialUsed ? (
              <Hint>Este piloto já usou o trial da Plataforma. Liberar de novo exige confirmação explícita.</Hint>
            ) : null}

            <AnimatePresence mode="wait">
              {confirm === "cancel" ||
              confirm === "trial" ||
              confirm === "trial-force" ||
              confirm === "plan-piloto" ||
              confirm === "plan-pro" ? (
                <motion.div
                  key={confirm}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-md border border-white/10 bg-black/20 px-3 py-3"
                >
                  <p className="text-sm font-semibold">
                    {confirm === "cancel"
                      ? "Cancelar no fim do período"
                      : confirm === "trial-force"
                        ? "Novo trial de 30 dias"
                        : confirm === "trial"
                          ? "Liberar trial de 30 dias"
                          : confirm === "plan-pro"
                            ? "Colocar no Piloto Pro (cortesia)"
                            : "Colocar no Piloto (cortesia)"}
                  </p>
                  <Hint className="mt-1">
                    {confirm === "cancel"
                      ? "O acesso segue até o fim do ciclo. Não estorna."
                      : confirm === "plan-pro"
                        ? "Não cobra. O Pro destrava Automações mesmo fora do checkout."
                        : confirm === "plan-piloto"
                          ? "Não cobra. Libera CRM e o fluxo do Piloto."
                          : "30 dias de Piloto, sem cobrança agora."}
                  </Hint>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={confirm === "cancel" ? "danger" : "primary"}
                      size="md"
                      disabled={act.isPending}
                      onClick={() => {
                        if (confirm === "cancel") {
                          act.mutate({ path: `/api/ops/users/${id}/cancel` });
                          return;
                        }
                        if (confirm === "trial" || confirm === "trial-force") {
                          act.mutate({
                            path: `/api/ops/users/${id}/trial`,
                            body: { force: confirm === "trial-force" },
                          });
                          return;
                        }
                        act.mutate({
                          path: `/api/ops/users/${id}/plan`,
                          body: {
                            sku: confirm === "plan-pro" ? "piloto_pro" : "piloto",
                          },
                        });
                      }}
                    >
                      {act.isPending ? "Aplicando…" : "Confirmar"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => setConfirm(null)}
                    >
                      Voltar
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="plan-actions"
                  className="flex flex-col gap-2"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="w-full justify-start"
                    onClick={() => {
                      setActionError(null);
                      setConfirm(u.platformTrialUsed ? "trial-force" : "trial");
                    }}
                  >
                    Liberar trial 30d
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="w-full justify-start"
                    onClick={() => {
                      setActionError(null);
                      setConfirm("plan-piloto");
                    }}
                  >
                    Colocar no Piloto
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    size="md"
                    className="w-full justify-start"
                    onClick={() => {
                      setActionError(null);
                      setConfirm("plan-pro");
                    }}
                  >
                    Colocar no Piloto Pro
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    className="w-full justify-start text-podium-alert hover:text-podium-alert"
                    onClick={() => {
                      setActionError(null);
                      setConfirm("cancel");
                    }}
                  >
                    Cancelar plano
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          <GlassCard id="ops-history" className="space-y-2 p-4" hover={false}>
            <SectionTitle>Movimentos</SectionTitle>
            <details className="group rounded-md border border-white/10 open:bg-white/[0.03]">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  Pedidos
                  <span className="text-xs font-medium text-podium-muted">
                    {u.orders.length === 0 ? "Nenhum" : formatInt(u.orders.length)}
                  </span>
                </span>
              </summary>
              <ul className="space-y-2 border-t border-white/10 px-3 py-3 text-sm text-podium-gray">
                {u.orders.length === 0 ? (
                  <li>Nenhum pedido.</li>
                ) : (
                  u.orders.map((o) => (
                    <li key={o.id} className="flex justify-between gap-2">
                      <span>
                        {getCatalogItem(o.sku)?.nome ?? o.sku} · {orderStatusLabel(o.status)}
                      </span>
                      <span className="tabular-nums">{formatBrl(o.amountCents)}</span>
                    </li>
                  ))
                )}
              </ul>
            </details>
            <details className="group rounded-md border border-white/10 open:bg-white/[0.03]">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  Lotes abertos
                  <span className="text-xs font-medium text-podium-muted">
                    {u.lots.length === 0 ? "Nenhum" : formatInt(u.lots.length)}
                  </span>
                </span>
              </summary>
              <ul className="space-y-3 border-t border-white/10 px-3 py-3 text-sm text-podium-gray">
                {u.lots.length === 0 ? (
                  <li>Nenhum lote aberto.</li>
                ) : (
                  u.lots.map((lot) => {
                    const pct = lot.qty > 0 ? Math.round((lot.remaining / lot.qty) * 100) : 0;
                    return (
                      <li key={lot.id}>
                        <div className="flex justify-between gap-2">
                          <span>
                            {lotSourceLabel(lot.source)} · {formatInt(lot.remaining)}/
                            {formatInt(lot.qty)}
                          </span>
                          <span>{lot.expiresAt ? formatDay(lot.expiresAt) : "sem prazo"}</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-podium-yellow/80"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </details>
            <details className="group rounded-md border border-white/10 open:bg-white/[0.03]" open>
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  Ledger
                  <span className="text-xs font-medium text-podium-muted">
                    {u.ledger.length === 0 ? "Vazio" : formatInt(u.ledger.length)}
                  </span>
                </span>
              </summary>
              <ul className="max-h-72 space-y-2 overflow-y-auto border-t border-white/10 px-3 py-3 text-sm text-podium-gray">
                {u.ledger.length === 0 ? (
                  <li>Sem movimentos.</li>
                ) : (
                  u.ledger.map((e) => (
                    <li key={e.id} className="flex justify-between gap-2">
                      <span>
                        {ledgerReasonLabel(e.reason)}
                        <span className="text-podium-muted"> · {formatDay(e.createdAt)}</span>
                      </span>
                      <span
                        className={cn(
                          "tabular-nums",
                          e.type === "debit" || e.type === "expire"
                            ? "text-podium-alert"
                            : "text-podium-yellow",
                        )}
                      >
                        {ledgerSign(e.type)}
                        {formatInt(e.amount)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </details>
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}
