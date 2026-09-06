"use client";

import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import { Button } from "@/components/ui/Button";
import {
  cohortLabel,
  formatBrl,
  formatDay,
  formatInt,
  planLabel,
} from "@/app/ops/_components/format";
import { creditsPhrase, getCatalogItem } from "@/lib/billing/catalog";
import type { OpsUserDetail } from "@/lib/ops/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const fieldClass =
  "w-28 rounded-md border border-white/10 bg-podium-panel px-2.5 py-1.5 text-xs text-podium-white outline-none focus:border-podium-yellow/40";

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

export function OpsUserSheet({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [qty, setQty] = useState("100");
  const [confirm, setConfirm] = useState<
    null | "credits" | "credits-revoke" | "cancel" | "trial" | "trial-force"
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const u = query.data;
  const creditsQty = Number.parseInt(qty, 10);

  return (
    <div className="space-y-6">
      <Link
        href="/ops"
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
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {u.nome || "Sem nome"}
            </h1>
            <p className="mt-1 text-sm text-podium-muted">
              {u.email || "sem e-mail"}
              {u.empresa ? ` · ${u.empresa}` : ""}
              {u.cidade ? ` · ${u.cidade}` : ""}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <GlassCard className="p-3" hover={false}>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                Plano
              </p>
              <p className="mt-1 font-semibold">{planLabel(u.plan)}</p>
              <Hint className="mt-1">
                {cohortLabel(u.cohort)}
                {u.cancelAtPeriodEnd ? " · cancela no fim" : ""}
              </Hint>
            </GlassCard>
            <GlassCard className="p-3" hover={false}>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                Créditos
              </p>
              <p className="mt-1 font-semibold">{formatInt(u.credits)}</p>
              <Hint className="mt-1">
                plano {formatInt(u.balance.plan)} · pack{" "}
                {formatInt(u.balance.pack)}
              </Hint>
            </GlassCard>
            <GlassCard className="p-3" hover={false}>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                LTV
              </p>
              <p className="mt-1 font-semibold">{formatBrl(u.ltvCents)}</p>
              <Hint className="mt-1">Soma dos pedidos pagos</Hint>
            </GlassCard>
            <GlassCard className="p-3" hover={false}>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                Ativação
              </p>
              <p className="mt-1 font-semibold">
                {u.activated ? "Sim" : "Não"}
              </p>
              <Hint className="mt-1">
                Setup {formatDay(u.onboardingCompletedAt)} · cadastro{" "}
                {formatDay(u.createdAt)}
              </Hint>
            </GlassCard>
          </div>

          <GlassCard className="p-3" hover={false}>
            <p className="text-sm font-semibold">Uso</p>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-sm text-podium-gray md:grid-cols-4">
              <li>Buscas {formatInt(u.usage.searches)}</li>
              <li>Qualificações {formatInt(u.usage.enrich)}</li>
              <li>Ligações {formatInt(u.usage.calls)}</li>
              <li>Leads salvos {formatInt(u.usage.savedLeads)}</li>
            </ul>
          </GlassCard>

          <GlassCard className="space-y-3 p-3" hover={false}>
            <SectionTitle>Ações</SectionTitle>
            {actionError ? (
              <p className="text-sm text-podium-alert">{actionError}</p>
            ) : null}

            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                Créditos
                <input
                  className={`mt-1 block ${fieldClass}`}
                  type="number"
                  min={1}
                  max={50000}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              {confirm === "credits" || confirm === "credits-revoke" ? (
                <>
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
                    {confirm === "credits-revoke"
                      ? `Confirmar retirada de ${creditsPhrase(Number.isFinite(creditsQty) ? creditsQty : 0)}`
                      : `Confirmar ${creditsPhrase(Number.isFinite(creditsQty) ? creditsQty : 0)}`}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setConfirm(null)}
                  >
                    Voltar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
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
                    onClick={() => {
                      setActionError(null);
                      setConfirm("credits-revoke");
                    }}
                  >
                    Retirar créditos
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {confirm === "cancel" ? (
                <>
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate({ path: `/api/ops/users/${id}/cancel` })
                    }
                  >
                    Confirmar cancelamento no fim do período
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setConfirm(null)}
                  >
                    Voltar
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setActionError(null);
                    setConfirm("cancel");
                  }}
                >
                  Cancelar plano
                </Button>
              )}

              {confirm === "trial" || confirm === "trial-force" ? (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate({
                        path: `/api/ops/users/${id}/trial`,
                        body: { force: confirm === "trial-force" },
                      })
                    }
                  >
                    {confirm === "trial-force"
                      ? "Confirmar novo trial de 30 dias"
                      : "Confirmar trial de 30 dias"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setConfirm(null)}
                  >
                    Voltar
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setActionError(null);
                    setConfirm(u.platformTrialUsed ? "trial-force" : "trial");
                  }}
                >
                  Liberar trial 30d
                </Button>
              )}
            </div>
            {u.platformTrialUsed ? (
              <Hint>Este piloto já usou o trial da Plataforma. Liberar de novo exige confirmação explícita.</Hint>
            ) : null}
          </GlassCard>

          <div className="grid gap-3 md:grid-cols-2">
            <GlassCard className="p-3" hover={false}>
              <p className="text-sm font-semibold">Pedidos</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-podium-gray">
                {u.orders.length === 0 ? (
                  <li>Nenhum pedido.</li>
                ) : (
                  u.orders.map((o) => (
                    <li key={o.id} className="flex justify-between gap-2">
                      <span>
                        {getCatalogItem(o.sku)?.nome ?? o.sku} · {o.status}
                      </span>
                      <span>{formatBrl(o.amountCents)}</span>
                    </li>
                  ))
                )}
              </ul>
            </GlassCard>
            <GlassCard className="p-3" hover={false}>
              <p className="text-sm font-semibold">Lotes abertos</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-podium-gray">
                {u.lots.length === 0 ? (
                  <li>Nenhum lote aberto.</li>
                ) : (
                  u.lots.map((lot) => (
                    <li key={lot.id} className="flex justify-between gap-2">
                      <span>
                        {lot.source} · {formatInt(lot.remaining)}/{formatInt(lot.qty)}
                      </span>
                      <span>{lot.expiresAt ? formatDay(lot.expiresAt) : "sem prazo"}</span>
                    </li>
                  ))
                )}
              </ul>
            </GlassCard>
          </div>

          <GlassCard className="p-3" hover={false}>
            <p className="text-sm font-semibold">Ledger</p>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm text-podium-gray">
              {u.ledger.length === 0 ? (
                <li>Sem movimentos.</li>
              ) : (
                u.ledger.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span>
                      {e.type} · {e.reason}
                    </span>
                    <span>
                      {e.type === "debit" ? "−" : "+"}
                      {formatInt(e.amount)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}
