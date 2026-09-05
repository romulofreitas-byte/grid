"use client";

import { COPY } from "@/lib/copy";
import { isSkuOnSale, PLANS } from "@/lib/billing/catalog";
import { pagarHref } from "@/lib/billing/href";
import { cn } from "@/lib/utils";
import { PlanCard } from "@/components/billing/PlanCard";
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
          <h2 className="mt-3 max-w-xl text-balance text-2xl font-extrabold tracking-tight text-podium-white md:text-4xl">
            {COPY.landingPlansTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-podium-muted md:text-base">
            {COPY.landingPlansBody}
          </p>
        </motion.div>

        <div className="mt-12 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BILLED.map((plan, i) => {
            const featured = plan.sku === "piloto";
            const onSale = plan.sku === "free" || isSkuOnSale(plan.sku);
            const href =
              plan.sku === "free"
                ? signedIn
                  ? "/painel"
                  : "/entrar?modo=cadastro"
                : pagarHref(plan.sku);
            const ctaLabel =
              plan.sku === "free"
                ? signedIn
                  ? COPY.landingSignedInCta
                  : COPY.landingPlansCtaFree
                : onSale
                  ? COPY.landingPlansCtaPaid
                  : COPY.landingPlansCtaSoon;
            const ctaClass = cn(
              "inline-flex w-full justify-center rounded-xl py-3 text-sm font-extrabold transition",
              featured
                ? "bg-podium-yellow text-podium-navy hover:brightness-110"
                : onSale
                  ? "border border-white/15 text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
                  : "cursor-not-allowed border border-white/10 text-podium-muted",
            );

            return (
              <motion.div
                key={plan.sku}
                className="h-full"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.45,
                  delay: reduce ? 0 : i * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <PlanCard
                  plan={plan}
                  featured={featured}
                  variant="landing"
                  eyebrow={
                    featured
                      ? COPY.landingPlansFeatured
                      : plan.sku === "free"
                        ? COPY.landingCtaStart
                        : "Assinatura"
                  }
                  cta={
                    onSale ? (
                      <Link href={href} className={ctaClass}>
                        {ctaLabel}
                      </Link>
                    ) : (
                      <span aria-disabled="true" className={ctaClass}>
                        {ctaLabel}
                      </span>
                    )
                  }
                />
              </motion.div>
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
