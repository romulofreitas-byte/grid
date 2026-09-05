"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { CopyFeedback } from "@/components/CopyFeedback";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { SectionTitle } from "@/components/SectionTitle";
import { StartingLights } from "@/components/StartingLights";
import { useHoldLights, usePodiumWait } from "@/hooks/usePodiumWait";
import {
  catalogBenefitLines,
  formatBrl,
  getCatalogItem,
  isSkuOnSale,
  SKU_OFF_SALE_MESSAGE,
  type PaymentMethod,
} from "@/lib/billing/catalog";
import { DEFAULT_PLATFORM_COUPON } from "@/lib/billing/platform-coupon";
import {
  pagarPendenteHref,
  pagarSucessoHref,
  planosHref,
} from "@/lib/billing/href";
import type { BillingOrder } from "@/lib/billing/types";
import { cn } from "@/lib/utils";

const METHODS: Array<{ id: PaymentMethod; label: string; hint: string }> = [
  { id: "pix", label: "Pix", hint: "QR na hora, crédito quando cair" },
  { id: "card_br", label: "Cartão BR", hint: "Via Asaas, sem número no GRID" },
  { id: "boleto", label: "Boleto", hint: "Crédito em 1–3 dias úteis" },
  { id: "card_intl", label: "Cartão internacional", hint: "Stripe, para quem está fora" },
];

const enterEase = [0.16, 1, 0.3, 1] as const;
const fillCard =
  "flex h-full min-h-0 w-full flex-col p-6 hover:translate-y-0 md:p-8";

function PagarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  const sku = searchParams.get("sku") ?? "piloto";
  const from = searchParams.get("from");
  const planosBack = {
    href: planosHref(from),
    label: "Voltar aos planos",
  };
  const item = getCatalogItem(sku);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [documento, setDocumento] = useState("");
  const [coupon, setCoupon] = useState(
    sku === "membro_plataforma" ? DEFAULT_PLATFORM_COUPON : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<BillingOrder | null>(null);
  const pixWaiting = Boolean(order?.status === "pending" && order.method === "pix");
  const { litCount: busyLit } = useHoldLights(busy && !pixWaiting, true);
  const { phase, litCount, goToSuccess } = usePodiumWait(pixWaiting, from);

  const needsDoc = method !== "card_intl" && sku !== "membro_plataforma";
  const isPlatform = sku === "membro_plataforma";

  useEffect(() => {
    void fetch("/api/profile")
      .then((r) => r.json())
      .then((p: { documento?: string | null }) => {
        if (p.documento) setDocumento(p.documento);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!order || order.status !== "pending") return;
    if (order.method === "boleto") return;
    const timer = window.setInterval(() => {
      void fetch(`/api/billing/order/${order.id}`)
        .then((r) => r.json())
        .then((json: { order?: BillingOrder }) => {
          if (!json.order) return;
          if (json.order.status === "paid") {
            goToSuccess(json.order.id);
            return;
          }
          setOrder(json.order);
        });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [order, goToSuccess]);

  const priceLabel = useMemo(() => {
    if (!item) return "";
    if (item.kind === "plan" && item.priceCents === 0) return "Grátis com cupom";
    return formatBrl(item.priceCents);
  }, [item]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        method: isPlatform ? "pix" : method,
        documento: documento || undefined,
        coupon: coupon || undefined,
      }),
    });
    const json = (await res.json()) as { order?: BillingOrder; error?: string };
    setBusy(false);
    if (!res.ok || !json.order) {
      setError(json.error ?? "Não foi possível iniciar o pagamento");
      return;
    }
    if (json.order.checkoutUrl && json.order.status !== "paid") {
      window.location.href = json.order.checkoutUrl;
      return;
    }
    if (json.order.status === "paid") {
      router.push(pagarSucessoHref(json.order.id, from));
      return;
    }
    if (json.order.method === "boleto") {
      router.push(pagarPendenteHref(json.order.id, from));
      return;
    }
    setOrder(json.order);
  }

  async function simulate() {
    if (!order) return;
    setBusy(true);
    const res = await fetch(`/api/billing/order/${order.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "simulate" }),
    });
    const json = (await res.json()) as { order?: BillingOrder; error?: string };
    setBusy(false);
    if (json.order?.status === "paid") {
      goToSuccess(json.order.id);
    } else {
      setError(json.error ?? "Ainda pendente");
    }
  }

  if (!item) {
    return (
      <AppShell title="Pagar" back={planosBack}>
        <p className="mt-6 text-sm text-podium-muted">SKU inválido.</p>
        <Link href={planosBack.href} className="mt-4 inline-block text-podium-yellow">
          Ver planos
        </Link>
      </AppShell>
    );
  }

  const offSale = !isSkuOnSale(sku);

  return (
    <AppShell fill title="Pagar" back={planosBack}>
      <div className="shrink-0">
        <SectionTitle>Pagamento</SectionTitle>
        <p className="mt-2 text-sm text-podium-muted">
          Pix em destaque. Cartão e boleto usam Asaas; cartão internacional, Stripe.
          Circle não aparece aqui — é tesouraria.
        </p>
      </div>

      <div className="mt-6 grid min-h-0 flex-1 auto-rows-fr gap-6 lg:grid-cols-2">
        <motion.div
          className="flex min-h-0"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: enterEase }}
        >
          <GlassCard className={cn(fillCard, "justify-between")} highlight>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
              {item.kind === "pack" ? "Recarga" : "Plano"}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold md:text-4xl">{item.nome}</h2>
            <p className="mt-2 text-sm text-podium-gray md:text-base">{item.tagline}</p>
            <p className="mt-6 text-4xl font-extrabold text-podium-yellow md:text-5xl">
              {priceLabel}
            </p>
            <p className="mt-2 text-sm text-podium-muted md:text-base">
              {item.credits.toLocaleString("pt-BR")} créditos
            </p>
            <ul className="mt-8 space-y-3 border-t border-white/10 pt-6">
              {catalogBenefitLines(item).map((line) => (
                <li key={line} className="flex gap-3 text-sm text-podium-gray">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-podium-yellow" />
                  {line}
                </li>
              ))}
            </ul>
          </GlassCard>
        </motion.div>

        <motion.div
          className="flex min-h-0"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: enterEase, delay: reduce ? 0 : 0.08 }}
        >
          <GlassCard className={fillCard}>
            {offSale ? (
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
                  Em breve
                </p>
                <h3 className="text-xl font-extrabold">Fora de venda</h3>
                <p className="text-sm text-podium-gray">{SKU_OFF_SALE_MESSAGE}</p>
                <Link
                  href={planosBack.href}
                  className="mt-2 inline-flex justify-center rounded-xl bg-podium-yellow py-3.5 text-sm font-extrabold text-podium-navy hover:brightness-110"
                >
                  Ver planos
                </Link>
              </div>
            ) : pixWaiting ? (
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-5">
                <div className="flex flex-col items-center gap-3 text-center">
                  <StartingLights litCount={litCount} phase={phase} />
                  <h3 className="text-balance text-xl font-extrabold">
                    Aguardando o sinal do banco
                  </h3>
                </div>
                {order?.pixQr ? (
                  <div className="pix-qr-ring mx-auto w-fit rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.pixQr}
                      alt="QR Code Pix"
                      className="h-56 w-56 rounded-xl bg-white p-2 md:h-64 md:w-64"
                    />
                  </div>
                ) : null}
                {order?.pixCopy ? (
                  <CopyFeedback
                    value={order.pixCopy}
                    label="Copia e cola"
                    multiline
                    actionLabel="Copiar código"
                  />
                ) : null}
                <p className="text-balance text-center text-sm text-podium-gray">
                  {phase === "go"
                    ? "Pagamento confirmado — crédito a caminho"
                    : "Pague o QR; o GRID confirma sozinho"}
                </p>
                {order?.provider === "mock" ? (
                  <button
                    type="button"
                    onClick={() => void simulate()}
                    disabled={busy || phase === "go"}
                    className="w-full rounded-xl border border-podium-yellow/40 py-3 text-sm font-bold text-podium-yellow disabled:opacity-60"
                  >
                    Confirmar pagamento (demo)
                  </button>
                ) : null}
              </div>
            ) : (
              <form
                onSubmit={(e) => void submit(e)}
                className="flex min-h-0 flex-1 flex-col gap-4"
              >
                {!isPlatform ? (
                  <fieldset className="min-h-0 flex-1">
                    <legend className="text-sm font-bold">Como pagar</legend>
                    <div className="mt-3 grid gap-2">
                      {METHODS.map((m) => (
                        <motion.label
                          key={m.id}
                          animate={
                            reduce
                              ? undefined
                              : { scale: method === m.id ? 1.01 : 1 }
                          }
                          transition={{ duration: 0.18 }}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm motion-safe:hover:border-podium-yellow/30",
                            method === m.id
                              ? "border-podium-yellow/50 bg-podium-yellow/10 shadow-[0_0_24px_rgba(245,179,1,0.16)]"
                              : "border-white/10",
                          )}
                        >
                          <input
                            type="radio"
                            name="method"
                            checked={method === m.id}
                            onChange={() => setMethod(m.id)}
                            className="mt-1"
                          />
                          <span>
                            <span className="font-bold text-podium-white">{m.label}</span>
                            <span className="mt-0.5 block text-xs text-podium-muted">
                              {m.hint}
                            </span>
                          </span>
                        </motion.label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <label className="block text-sm text-podium-gray">
                    Cupom da Plataforma
                    <input
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                      placeholder={DEFAULT_PLATFORM_COUPON}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40"
                    />
                  </label>
                )}

                {needsDoc && !isPlatform ? (
                  <label className="block text-sm text-podium-gray">
                    CPF ou CNPJ
                    <input
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                      placeholder="000.000.000-00"
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none focus:border-podium-yellow/40"
                    />
                    <Hint className="mt-1">
                      Obrigatório no Asaas para Pix, cartão e boleto.
                    </Hint>
                  </label>
                ) : null}

                {error ? <p className="text-sm text-podium-yellow">{error}</p> : null}

                <div className="mt-auto">
                  {busy ? (
                    <div className="telemetry-bar mb-2 rounded-full" />
                  ) : null}
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-podium-yellow py-3.5 text-sm font-extrabold text-podium-navy disabled:opacity-60"
                  >
                    {busy ? (
                      <>
                        <StartingLights
                          compact
                          phase="hold"
                          litCount={busyLit}
                        />
                        Abrindo pagamento…
                      </>
                    ) : isPlatform ? (
                      "Ativar plano"
                    ) : (
                      "Continuar"
                    )}
                  </button>
                </div>
              </form>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </AppShell>
  );
}

export default function PagarPage() {
  return (
    <Suspense>
      <PagarInner />
    </Suspense>
  );
}
