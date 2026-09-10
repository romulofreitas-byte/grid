"use client";

import { COPY } from "@/lib/copy";
import { isSkuOnSale, PLANS } from "@/lib/billing/catalog";
import { pagarHref } from "@/lib/billing/href";
import { PlanCard } from "@/components/billing/PlanCard";
import { PilotoProWaitlistCta } from "@/components/billing/PilotoProWaitlistCta";
import { buttonClassName } from "@/components/ui/Button";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const BILLED = PLANS.filter((p) => p.sku !== "membro_plataforma");

export function LandingPlans({ signedIn }: { signedIn: boolean }) {
  const reduce = useReducedMotion();

  return (
    <section id="planos" className="scroll-mt-20 border-y border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
            {COPY.landingPlansEyebrow}
          </p>
          <h2 className="mt-3 max-w-xl text-balance text-xl font-semibold tracking-tight text-podium-white md:text-2xl">
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
            const waitlist = plan.sku === "piloto_pro" && !onSale;
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
                  : waitlist
                    ? COPY.landingPlansCtaWaitlist
                    : COPY.landingPlansCtaSoon;
            const ctaClass = featured
              ? buttonClassName({ variant: "primary", size: "md", className: "w-full" })
              : onSale
                ? buttonClassName({ variant: "secondary", size: "md", className: "w-full" })
                : buttonClassName({
                    variant: "primary",
                    size: "md",
                    className: "w-full",
                  });

            return (
              <motion.div
                key={plan.sku}
                id={plan.sku === "piloto_pro" ? "piloto-pro" : undefined}
                className="h-full scroll-mt-24"
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
                        : waitlist
                          ? COPY.landingPlansProEyebrow
                          : "Assinatura"
                  }
                  cta={
                    onSale ? (
                      <Link href={href} className={ctaClass}>
                        {ctaLabel}
                      </Link>
                    ) : waitlist ? (
                      <PilotoProWaitlistCta pathname="/" />
                    ) : (
                      <span aria-disabled="true" className={buttonClassName({
                        variant: "secondary",
                        size: "md",
                        className: "w-full cursor-not-allowed opacity-50",
                      })}>
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
          {COPY.landingPlansPayHint}{" "}
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
