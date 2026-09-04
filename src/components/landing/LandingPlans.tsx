"use client";

import { COPY } from "@/lib/copy";
import { formatBrl, isSkuOnSale, PLANS } from "@/lib/billing/catalog";
import { pagarHref } from "@/lib/billing/href";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const BILLED = PLANS.filter((p) => p.sku !== "membro_plataforma");

export function LandingPlans({ signedIn }: { signedIn: boolean }) {
  const reduce = useReducedMotion();

  return (
    <section id="planos" className="scroll-mt-20 border-y border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
            {COPY.landingPlansEyebrow}
          </p>
          <h2 className="mt-3 max-w-xl text-2xl font-extrabold tracking-tight text-podium-white md:text-4xl">
            {COPY.landingPlansTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-podium-muted md:text-base">
            {COPY.landingPlansBody}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BILLED.map((plan, i) => {
            const featured = plan.sku === "piloto";
            const onSale = plan.sku === "free" || isSkuOnSale(plan.sku);
            const href =
              plan.sku === "free"
                ? signedIn
                  ? "/painel"
                  : "/entrar?modo=cadastro"
                : pagarHref(plan.sku);
            const cta =
              plan.sku === "free"
                ? signedIn
                  ? COPY.landingSignedInCta
                  : COPY.landingPlansCtaFree
                : onSale
                  ? COPY.landingPlansCtaPaid
                  : COPY.landingPlansCtaSoon;

            return (
              <motion.article
                key={plan.sku}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.45,
                  delay: reduce ? 0 : i * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={cn(
                  "flex flex-col rounded-2xl border bg-white/[0.03] p-5",
                  featured
                    ? "border-podium-yellow/40 ring-1 ring-podium-yellow/25"
                    : "border-white/[0.08]",
                )}
              >
                {featured ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-yellow">
                    {COPY.landingPlansFeatured}
                  </p>
                ) : (
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                    {plan.sku === "free" ? COPY.landingCtaStart : "Assinatura"}
                  </p>
                )}
                <h3 className="mt-2 text-xl font-extrabold">{plan.nome}</h3>
                <p className="mt-1 text-sm text-podium-muted">{plan.tagline}</p>
                <p className="mt-4 text-3xl font-extrabold text-podium-yellow">
                  {plan.priceCents === 0 ? "Grátis" : formatBrl(plan.priceCents)}
                  {plan.priceCents > 0 ? (
                    <span className="text-sm font-medium text-podium-muted">
                      /mês
                    </span>
                  ) : null}
                </p>
                {plan.sku === "piloto_pro" || plan.sku === "escuderia" ? (
                  <div className="mt-4 flex-1" />
                ) : (
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-podium-gray">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-podium-yellow" />
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
                {onSale ? (
                  <Link
                    href={href}
                    className={cn(
                      "mt-6 inline-flex justify-center rounded-xl py-3 text-sm font-extrabold transition",
                      featured
                        ? "bg-podium-yellow text-podium-navy hover:brightness-110"
                        : "border border-white/15 text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white",
                    )}
                  >
                    {cta}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="mt-6 inline-flex cursor-not-allowed justify-center rounded-xl border border-white/10 py-3 text-sm font-extrabold text-podium-muted"
                  >
                    {cta}
                  </span>
                )}
              </motion.article>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-podium-muted">
          <Link
            href="/planos#recarga"
            className="font-bold text-podium-gray underline-offset-4 hover:text-podium-white hover:underline"
          >
            {COPY.landingPlansMore}
          </Link>
        </p>
      </div>
    </section>
  );
}
