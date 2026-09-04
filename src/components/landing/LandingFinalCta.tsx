"use client";

import { COPY } from "@/lib/copy";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

export function LandingFinalCta({ signedIn }: { signedIn: boolean }) {
  const reduce = useReducedMotion();

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
      <motion.div
        className="max-w-2xl"
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="text-3xl font-extrabold tracking-tight text-podium-white md:text-5xl">
          {COPY.landingFinalTitle}
        </h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-podium-muted md:text-lg">
          {COPY.landingFinalBody}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={signedIn ? "/painel" : "/entrar?modo=cadastro"}
            className="rounded-xl bg-podium-yellow px-7 py-3.5 text-sm font-bold text-podium-navy transition hover:brightness-110"
          >
            {signedIn ? COPY.landingSignedInCta : COPY.landingCtaStart}
          </Link>
          <Link
            href="/entrar"
            className="text-sm font-bold text-podium-muted transition hover:text-podium-white"
          >
            {signedIn ? COPY.landingSwitchAccount : COPY.entrarLoginLane}
          </Link>
          <a
            href="#planos"
            className="text-sm font-bold text-podium-muted transition hover:text-podium-white"
          >
            {COPY.landingCtaPlans}
          </a>
        </div>
      </motion.div>
    </section>
  );
}
