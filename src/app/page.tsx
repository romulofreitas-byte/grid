"use client";

import { BenefitGrid } from "@/components/BenefitGrid";
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

export default function LandingPage() {
  const reduce = useReducedMotion();
  const signedIn = useSignedIn();

  return (
    <div className="relative h-svh overflow-hidden">
      <RaceAtmosphere />
      <div className="mx-auto flex h-full max-w-6xl flex-col justify-between gap-6 px-4 py-8 md:py-10 lg:py-12">
        <motion.div
          className="flex min-h-0 flex-1 flex-col justify-center"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-fit">
            <BrandLogo
              variant="endorsed"
              className="h-[4.5rem] w-auto text-[4.5rem] md:h-20 md:text-[5rem]"
              priority
            />
          </div>
          <h1 className="mt-6 max-w-xl text-base font-medium leading-snug text-podium-gray md:mt-8 md:text-xl">
            {COPY.landingPromessa}
          </h1>
          {!signedIn ? (
            <p className="mt-2 max-w-xl text-sm text-podium-muted md:text-base">
              {COPY.landingPrimeiraVez}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap items-center gap-4 md:mt-8">
            <Link
              href={signedIn ? "/box" : "/entrar"}
              className="rounded-xl bg-podium-yellow px-6 py-3 text-sm font-bold text-podium-navy transition hover:brightness-110"
            >
              {signedIn ? "Ir ao Box" : "Começar"}
            </Link>
            {!signedIn ? (
              <Link
                href="/entrar?modo=entrar"
                className="text-sm font-bold text-podium-muted hover:text-podium-white"
              >
                Já tenho conta
              </Link>
            ) : null}
            <Link
              href="/planos"
              className="text-sm font-bold text-podium-muted hover:text-podium-white"
            >
              Ver planos
            </Link>
            <Link
              href="/privacidade"
              className="text-sm text-podium-muted hover:text-podium-white"
            >
              Privacidade
            </Link>
            <Link
              href="/bot"
              className="text-sm text-podium-muted hover:text-podium-white"
            >
              GridBot
            </Link>
            <Link
              href="/duvidas"
              className="text-sm text-podium-muted hover:text-podium-white"
            >
              Dúvidas
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="shrink-0"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: reduce ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
            O que vem na lista
          </p>
          <BenefitGrid />
        </motion.div>
      </div>
    </div>
  );
}
