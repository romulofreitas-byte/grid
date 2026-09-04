"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

const ANCHORS = [
  { href: "#como-funciona", label: COPY.landingNavHow },
  { href: "#qualificacao", label: COPY.landingNavQualify },
  { href: "#crm", label: COPY.landingNavCrm },
  { href: "#planos", label: COPY.landingNavPlans },
] as const;

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-podium-navy/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="GRID" className="shrink-0">
          <BrandLogo variant="solo" className="h-8 w-auto text-2xl" />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Seções">
          {ANCHORS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-podium-muted transition hover:text-podium-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={signedIn ? "/painel" : "/entrar?modo=cadastro"}
            className="rounded-xl bg-podium-yellow px-4 py-2 text-sm font-bold text-podium-navy transition hover:brightness-110"
          >
            {signedIn ? COPY.landingSignedInCta : COPY.landingCtaStart}
          </Link>
          {!signedIn ? (
            <Link
              href="/entrar"
              className="hidden text-sm font-bold text-podium-muted transition hover:text-podium-white sm:inline"
            >
              {COPY.entrarLoginLane}
            </Link>
          ) : null}
          <button
            type="button"
            className="inline-flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-lg border border-white/10 text-podium-gray lg:hidden"
            aria-expanded={open}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span
              aria-hidden
              className={cn(
                "block h-0.5 w-4 bg-current transition",
                open && "translate-y-1.5 rotate-45",
              )}
            />
            <span
              aria-hidden
              className={cn(
                "block h-0.5 w-4 bg-current transition",
                open && "-translate-y-1.5 -rotate-45",
              )}
            />
          </button>
        </div>
      </div>

      {open ? (
        <nav
          className="border-t border-white/[0.06] px-4 py-3 lg:hidden"
          aria-label="Seções"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {ANCHORS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-semibold text-podium-gray hover:bg-white/[0.04] hover:text-podium-white"
              >
                {item.label}
              </a>
            ))}
            {!signedIn ? (
              <Link
                href="/entrar"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-semibold text-podium-muted sm:hidden"
              >
                {COPY.entrarLoginLane}
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
