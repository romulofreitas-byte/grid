"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { RaceAtmosphere } from "@/components/RaceAtmosphere";
import {
  StartingLights,
  type LightsPhase,
} from "@/components/StartingLights";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BACK } from "@/lib/back";
import { COPY } from "@/lib/copy";
import { isPaymentNext, safeInternalPath } from "@/lib/auth/next-path";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function EntrarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<LightsPhase>("idle");
  const [litCount, setLitCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const next = safeInternalPath(searchParams.get("next"));
  const paying = isPaymentNext(next);

  async function lightsOutThenGo(dest = next) {
    if (reduce) {
      router.push(dest);
      return;
    }
    setPhase("lighting");
    for (let i = 1; i <= 5; i++) {
      setLitCount(i);
      await sleep(95);
    }
    await sleep(200);
    setPhase("out");
    setLitCount(0);
    await sleep(140);
    setPhase("go");
    await sleep(320);
    router.push(dest);
  }

  useEffect(() => {
    if (searchParams.get("go") === "1") {
      void lightsOutThenGo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function enter(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setNotice(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next }),
    });
    const json = (await res.json()) as {
      mock?: boolean;
      magic?: boolean;
      error?: string;
      next?: string;
    };
    if (!res.ok) {
      setLoading(false);
      setNotice(json.error ?? "Não foi possível entrar");
      return;
    }
    if (json.magic) {
      setLoading(false);
      setNotice(COPY.loginMagic);
      return;
    }
    localStorage.setItem("grid_mock_session", "1");
    await lightsOutThenGo(json.next ?? next);
  }

  async function google() {
    if (loading) return;
    setLoading(true);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", next }),
    });
    const json = (await res.json()) as { mock?: boolean; url?: string; error?: string };
    if (json.mock) {
      localStorage.setItem("grid_mock_session", "1");
      await lightsOutThenGo();
      return;
    }
    if (json.url) {
      window.location.href = json.url;
      return;
    }
    setLoading(false);
    setNotice(json.error ?? "Google indisponível nesta demonstração");
  }

  return (
    <div className="relative h-svh overflow-hidden">
      <RaceAtmosphere />

      <AnimatePresence>
        {phase === "go" ? (
          <motion.div
            key="go-flash"
            className="pointer-events-none fixed inset-0 z-50 bg-podium-yellow"
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      <div className="grid h-full overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden min-h-0 flex-col justify-between px-12 py-12 lg:flex lg:px-16">
          <h1 className="w-fit">
            <BrandLogo
              variant="endorsed"
              className="h-10 w-auto text-[2.5rem]"
              priority
            />
          </h1>

          <div className="max-w-xl">
            <StartingLights
              litCount={litCount}
              phase={phase}
              className="mb-8"
            />
            <p className="max-w-md text-lg text-podium-gray">
              {COPY.loginPainel}
            </p>
          </div>

          <span />
        </section>

        <aside className="relative flex h-full min-h-0 flex-col justify-center overflow-hidden border-white/10 bg-black/35 backdrop-blur-2xl lg:border-l">
          <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-conic-gradient(#0b1a2e_0%_25%,#f5b301_0%_50%)] bg-[length:10px_10px] opacity-80" />
          <div className="w-full px-6 py-8 md:px-12 lg:px-14">
            <div className="mb-6 lg:hidden">
              <h1 className="w-fit">
                <BrandLogo
                  variant="endorsed"
                  className="h-9 w-auto text-[2.25rem]"
                  priority
                />
              </h1>
              <StartingLights
                litCount={litCount}
                phase={phase}
                className="mt-5"
              />
            </div>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
                Acesso
              </p>
              <h2 className="text-2xl font-extrabold">
                {paying ? "Entre para pagar" : "Entrar com o e-mail"}
              </h2>
            </div>
            <p className="text-sm text-podium-muted">
              {paying
                ? "Entre para concluir o pagamento. Sem senha — link mágico ou Google."
                : COPY.loginSub}
            </p>
            <form onSubmit={enter} className="mt-6 space-y-4">
              <label className="block text-sm text-podium-gray">
                E-mail
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40"
                />
              </label>
              {notice ? (
                <p className="text-sm text-podium-yellow">{notice}</p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-podium-yellow py-3.5 text-sm font-extrabold text-podium-navy transition hover:brightness-110 disabled:opacity-60"
              >
                {loading ? "Entrando…" : "Entrar"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void google()}
                className="w-full rounded-xl border border-white/15 py-3 text-sm font-medium text-podium-gray transition hover:border-white/30 hover:text-podium-white disabled:opacity-60"
              >
                Continuar com Google
              </button>
            </form>
            <Link
              href={BACK.inicio.href}
              className="mt-6 inline-block text-sm text-podium-muted hover:text-podium-white"
            >
              ← {BACK.inicio.label}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <EntrarInner />
    </Suspense>
  );
}
