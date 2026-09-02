"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { CopyFeedback } from "@/components/CopyFeedback";
import { GlassCard } from "@/components/GlassCard";
import { StartingLights } from "@/components/StartingLights";
import { usePodiumWait } from "@/hooks/usePodiumWait";
import { planosHref } from "@/lib/billing/href";
import type { BillingOrder } from "@/lib/billing/types";
import { cn } from "@/lib/utils";

const STEPS = [
  "Boleto gerado",
  "Aguardando compensação",
  "Crédito na conta",
] as const;

function BoletoTimeline({ complete }: { complete: boolean }) {
  return (
    <ol className="space-y-4">
      {STEPS.map((label, i) => {
        const state = complete
          ? "done"
          : i === 0
            ? "done"
            : i === 1
              ? "active"
              : "todo";
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold",
                state === "done" &&
                  "border-podium-success/40 bg-podium-success/20 text-podium-success",
                state === "active" &&
                  "border-podium-yellow/50 bg-podium-yellow/15 text-podium-yellow recommend-pulse",
                state === "todo" && "border-white/15 bg-white/5 text-podium-muted",
              )}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "text-sm md:text-base",
                state === "todo" ? "text-podium-muted" : "text-podium-white",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PendenteInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("order");
  const from = searchParams.get("from");
  const reduce = useReducedMotion();
  const [order, setOrder] = useState<BillingOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { phase, litCount, goToSuccess } = usePodiumWait(false, from);
  const complete = phase === "go";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/billing/order/${id}`);
      const json = (await res.json()) as { order?: BillingOrder };
      if (cancelled || !json.order) return;
      setOrder(json.order);
      if (json.order.status === "paid") {
        goToSuccess(json.order.id);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, goToSuccess]);

  async function simulate() {
    if (!id) return;
    const res = await fetch(`/api/billing/order/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "simulate" }),
    });
    const json = (await res.json()) as { order?: BillingOrder; error?: string };
    if (json.order?.status === "paid") {
      goToSuccess(json.order.id);
      return;
    }
    setError(json.error ?? "Ainda pendente");
  }

  return (
    <AppShell fill title="Boleto" back={{ href: planosHref(from), label: "Voltar aos planos" }}>
      <motion.div
        className="flex min-h-0 flex-1 flex-col"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlassCard className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 hover:translate-y-0">
          <div className="grid min-h-0 flex-1 auto-rows-fr lg:grid-cols-2">
            <div className="flex flex-col justify-center gap-8 p-6 md:p-10">
              <div>
                <StartingLights litCount={litCount} phase={phase} />
                <h1 className="mt-5 text-3xl font-extrabold md:text-4xl">Boleto gerado</h1>
                <p className="mt-3 max-w-md text-sm text-podium-gray md:text-base">
                  O crédito entra depois da compensação (1 a 3 dias úteis). Guarde o
                  comprovante.
                </p>
              </div>
              <BoletoTimeline complete={complete} />
            </div>
            <div className="flex flex-col justify-center gap-5 border-t border-white/10 p-6 md:p-10 lg:border-l lg:border-t-0">
              {order?.boletoLine ? (
                <CopyFeedback
                  value={order.boletoLine}
                  label="Linha digitável"
                  actionLabel="Copiar linha"
                />
              ) : (
                <p className="text-sm text-podium-muted">Carregando linha digitável…</p>
              )}
              {order?.boletoUrl ? (
                <a
                  href={order.boletoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit text-sm font-bold text-podium-yellow"
                >
                  Abrir boleto
                </a>
              ) : null}
              {error ? <p className="text-sm text-podium-yellow">{error}</p> : null}
              {order?.provider === "mock" ? (
                <button
                  type="button"
                  onClick={() => void simulate()}
                  disabled={complete}
                  className="w-full rounded-xl border border-podium-yellow/40 px-4 py-3 text-sm font-bold text-podium-yellow disabled:opacity-60"
                >
                  Confirmar pagamento (demo)
                </button>
              ) : null}
              <Link
                href="/conta"
                className="text-sm text-podium-muted hover:text-podium-white"
              >
                Acompanhar em Conta
              </Link>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </AppShell>
  );
}

export default function PagarPendentePage() {
  return (
    <Suspense>
      <PendenteInner />
    </Suspense>
  );
}
