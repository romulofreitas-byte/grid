"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingBenefits } from "@/components/landing/LandingBenefits";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";
import { LandingListPreview } from "@/components/landing/LandingListPreview";
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

      <section className="relative flex min-h-svh flex-col justify-center overflow-hidden px-4 pb-16 pt-10 md:pb-20 md:pt-14">
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
            <motion.div
              className="w-fit"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease }}
            >
              <BrandLogo
                variant="endorsed"
                className="h-[4.5rem] w-auto text-[4.5rem] md:h-[5.5rem] md:text-[5.5rem]"
                priority
              />
            </motion.div>

            <motion.h1
              className="mt-7 max-w-xl text-lg font-medium leading-snug text-podium-gray md:mt-9 md:text-2xl md:leading-snug"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: reduce ? 0 : 0.08, ease }}
            >
              {COPY.landingPromessa}
            </motion.h1>

            {!signedIn ? (
              <motion.p
                className="mt-3 max-w-xl text-sm text-podium-muted md:text-base"
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
                href={signedIn ? "/box" : "/entrar"}
                className="rounded-xl bg-podium-yellow px-7 py-3.5 text-sm font-bold text-podium-navy transition hover:brightness-110"
              >
                {signedIn ? COPY.landingSignedInCta : "Começar"}
              </Link>
              <Link
                href="/entrar?modo=entrar"
                className="text-sm font-bold text-podium-muted transition hover:text-podium-white"
              >
                {signedIn
                  ? COPY.landingSwitchAccount
                  : COPY.entrarLoginLane}
              </Link>
              <Link
                href="/planos"
                className="text-sm font-bold text-podium-muted transition hover:text-podium-white"
              >
                Ver planos
              </Link>
            </motion.div>
          </div>

          <motion.div
            className="min-w-0 justify-self-stretch lg:justify-self-end"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: reduce ? 0 : 0.22, ease }}
          >
            <LandingListPreview />
          </motion.div>
        </div>

        <motion.div
          className="absolute inset-x-0 bottom-6 flex justify-center md:bottom-8"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.7, duration: 0.5 }}
          aria-hidden
        >
          <span className="flex flex-col items-center gap-2 text-[9px] font-bold uppercase tracking-[0.28em] text-podium-muted/80">
            Scroll
            <span className="h-8 w-px bg-gradient-to-b from-podium-yellow/70 to-transparent" />
          </span>
        </motion.div>
      </section>

      <HowItWorks />
      <LandingBenefits />
      <LandingFinalCta signedIn={signedIn} />

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <BrandLogo
            variant="endorsed"
            className="h-8 w-auto text-2xl opacity-80"
          />
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-podium-muted">
            <Link href="/planos" className="hover:text-podium-white">
              Planos
            </Link>
            <Link href="/duvidas" className="hover:text-podium-white">
              Dúvidas
            </Link>
            <Link href="/bot" className="hover:text-podium-white">
              GridBot
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
