"use client";

import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingBenefits } from "@/components/landing/LandingBenefits";
import { LandingCrm } from "@/components/landing/LandingCrm";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";
import { LandingListPreview } from "@/components/landing/LandingListPreview";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingPain } from "@/components/landing/LandingPain";
import { LandingPlans } from "@/components/landing/LandingPlans";
import { LandingQualify } from "@/components/landing/LandingQualify";
import { BrandLogo } from "@/components/BrandLogo";
import { RaceAtmosphere } from "@/components/RaceAtmosphere";
import { COPY } from "@/lib/copy";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("grid_mock_session") === "1") {
      setSignedIn(true);
      return;
    }
    const hasSupabase = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    if (!hasSupabase) return;
    void fetch("/api/profile").then((r) => {
      if (r.ok) setSignedIn(true);
    });
  }, []);
  return signedIn;
}

const ease = [0.16, 1, 0.3, 1] as const;

export default function LandingPage() {
  const reduce = useReducedMotion();
  const signedIn = useSignedIn();

  return (
    <div className="relative">
      <RaceAtmosphere />
      <LandingNav signedIn={signedIn} />

      <section className="relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-center overflow-hidden px-4 pb-16 pt-10 md:pb-20 md:pt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-podium-yellow/50 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-1/4 h-[420px] w-[420px] rounded-full bg-podium-yellow/[0.06] blur-3xl md:h-[520px] md:w-[520px]"
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div>
            <motion.h1
              className="max-w-xl text-balance text-3xl font-extrabold leading-tight tracking-tight text-podium-white md:text-5xl md:leading-tight"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease }}
            >
              {COPY.landingHeadline}
            </motion.h1>

            <motion.p
              className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-podium-gray md:text-lg"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: reduce ? 0 : 0.08, ease }}
            >
              {COPY.landingPromessa}
            </motion.p>

            {!signedIn ? (
              <motion.p
                className="mt-3 max-w-xl text-pretty text-sm text-podium-muted md:text-base"
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: reduce ? 0 : 0.14, ease }}
              >
                {COPY.landingPrimeiraVez}
              </motion.p>
            ) : null}

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-4 md:mt-10"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: reduce ? 0 : 0.18, ease }}
            >
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
            </motion.div>
          </div>

          <motion.div
            className="hidden min-w-0 justify-self-stretch lg:block lg:justify-self-end"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: reduce ? 0 : 0.22, ease }}
          >
            <LandingListPreview />
          </motion.div>
        </div>
      </section>

      <section className="relative lg:hidden">
        <div className="sticky top-14 z-30 border-b border-podium-yellow/25 bg-podium-navy/95 px-4 py-3 backdrop-blur-xl">
          <h2 className="text-lg font-extrabold tracking-tight text-podium-white">
            {COPY.landingPreviewLabel}
          </h2>
        </div>
        <motion.div
          className="mx-auto max-w-lg px-4 py-8"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease }}
        >
          <LandingListPreview
            hideEyebrow
            className="mx-auto ring-1 ring-podium-yellow/30"
          />
        </motion.div>
      </section>

      <LandingPain />
      <HowItWorks />
      <LandingBenefits />
      <LandingQualify />
      <LandingCrm />
      <LandingPlans signedIn={signedIn} />
      <LandingFinalCta signedIn={signedIn} />

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <div>
            <BrandLogo variant="solo" className="h-8 w-auto text-2xl opacity-80" />
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-podium-muted">
              {COPY.landingFooterNote}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-podium-muted">
            <a href="#planos" className="hover:text-podium-white">
              {COPY.landingNavPlans}
            </a>
            <Link href="/planos" className="hover:text-podium-white">
              {COPY.landingPlansMore}
            </Link>
            <Link href="/duvidas" className="hover:text-podium-white">
              Dúvidas
            </Link>
            <Link href="/privacidade" className="hover:text-podium-white">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-podium-white">
              Termos
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
