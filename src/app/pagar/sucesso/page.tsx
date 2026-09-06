"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { StartingLights } from "@/components/StartingLights";
import { buttonClassName } from "@/components/ui/Button";
import { getCatalogItem } from "@/lib/billing/catalog";
import { billingSuccessReturn } from "@/lib/billing/href";
import type { BillingOrder } from "@/lib/billing/types";

function CreditCount({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setN(value);
      return;
    }
    const start = performance.now();
    const dur = 600;
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 3;
      setN(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  return <span>{n.toLocaleString("pt-BR")}</span>;
}

function ConfirmCheck() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" aria-hidden>
      <circle
        cx="24"
        cy="24"
        r="22"
        className="fill-none stroke-podium-success/30"
        strokeWidth="2"
      />
      <path
        d="M14 25.5 21 32.5 34 16.5"
        className="podium-check-path fill-none stroke-podium-success"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SucessoInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const next = billingSuccessReturn(searchParams.get("from"));
  const reduce = useReducedMotion();
  const [order, setOrder] = useState<BillingOrder | null>(null);
  const item = order ? getCatalogItem(order.sku) : undefined;

  useEffect(() => {
    if (!orderId) return;
    void fetch(`/api/billing/order/${orderId}`)
      .then((r) => r.json())
      .then((json: { order?: BillingOrder }) => {
        if (json.order) setOrder(json.order);
      })
      .catch(() => undefined);
  }, [orderId]);

  return (
    <AppShell fill title="Pago" back={next}>
      <motion.div
        className="flex min-h-0 flex-1 flex-col"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlassCard
          className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 hover:translate-y-0"
          highlight
        >
          <div className="podium-checkered shrink-0" />
          <div className="grid min-h-0 flex-1 auto-rows-fr lg:grid-cols-2">
            <div className="flex flex-col items-center justify-center px-4 py-6 text-center md:px-8">
              <StartingLights litCount={5} phase="go" />
              <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
                Tudo certo
              </p>
              <h1 className="mt-2 text-balance text-xl font-semibold md:text-2xl">
                Pagamento confirmado
              </h1>
              {item ? (
                <p className="mt-2 text-pretty text-sm text-podium-gray">
                  {item.nome}
                  {" · "}
                  <span className="font-semibold text-podium-yellow">
                    <CreditCount value={item.credits} /> créditos
                  </span>{" "}
                  na conta
                </p>
              ) : (
                <p className="mt-2 text-pretty text-sm text-podium-gray">
                  Créditos já estão na conta.
                </p>
              )}
              <div className="mt-6">
                <ConfirmCheck />
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 border-t border-white/10 px-4 py-6 md:px-8 lg:border-l lg:border-t-0">
              <p className="text-pretty text-sm leading-relaxed text-podium-gray md:text-base">
                A mensalidade libera o CRM e o volume de créditos. Qualificar
                custa 1 crédito. Ligar pela ficha é grátis. Exportar a planilha
                custa mais.
              </p>
              {orderId ? (
                <p className="text-xs text-podium-muted">Pedido {orderId}</p>
              ) : null}
              <motion.div
                className="flex flex-wrap gap-3"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.28,
                  delay: reduce ? 0 : 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Link
                  href={next.href}
                  className={buttonClassName({
                    variant: "primary",
                    size: "md",
                    className: "recommend-pulse-once",
                  })}
                >
                  {next.label}
                </Link>
                <Link
                  href="/conta"
                  className={buttonClassName({ variant: "secondary", size: "md" })}
                >
                  Ver faturas
                </Link>
              </motion.div>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </AppShell>
  );
}

export default function PagarSucessoPage() {
  return (
    <Suspense>
      <SucessoInner />
    </Suspense>
  );
}
