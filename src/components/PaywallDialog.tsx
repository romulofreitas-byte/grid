"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { StartingLights } from "@/components/StartingLights";
import { pathWithSearch, withFrom } from "@/lib/billing/href";
import {
  paywallCopy,
  type PaywallCopy,
  type PaywallOpen,
} from "@/lib/billing/paywall";

type PaywallContextValue = {
  openPaywall: (input: PaywallOpen) => void;
};

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function usePaywall() {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within PaywallProvider");
  return ctx;
}

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PaywallOpen | null>(null);
  const pathname = usePathname();
  const openPaywall = useCallback((input: PaywallOpen) => setState(input), []);
  const close = useCallback(() => setState(null), []);

  useEffect(() => {
    setState(null);
  }, [pathname]);

  return (
    <PaywallContext.Provider value={{ openPaywall }}>
      {children}
      <Suspense fallback={null}>
        <PaywallDialog state={state} onClose={close} />
      </Suspense>
    </PaywallContext.Provider>
  );
}

function withOrigin(copy: PaywallCopy, from: string): PaywallCopy {
  return {
    ...copy,
    primary: { ...copy.primary, href: withFrom(copy.primary.href, from) },
    secondary:
      "href" in copy.secondary
        ? { ...copy.secondary, href: withFrom(copy.secondary.href, from) }
        : copy.secondary,
  };
}

function PaywallDialog({
  state,
  onClose,
}: {
  state: PaywallOpen | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = pathWithSearch(pathname, searchParams.toString());
  const copy = state ? withOrigin(paywallCopy(state), from) : null;

  useEffect(() => {
    if (!state) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  useEffect(() => {
    if (!state) return;
    const frame = window.requestAnimationFrame(() => primaryRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  if (!state || !copy) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlassCard
          highlight
          className="overflow-hidden p-0 hover:translate-y-0"
        >
          <div className="podium-checkered shrink-0" />
          <div className="relative px-6 py-8 text-center md:px-8">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl text-podium-muted hover:bg-white/5 hover:text-podium-white"
              title="Fechar"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </button>
            <StartingLights litCount={5} phase="hold" className="justify-center" />
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
              {copy.eyebrow}
            </p>
            <h2 id={titleId} className="mt-3 text-2xl font-extrabold md:text-3xl">
              {copy.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-podium-gray md:text-base">
              {copy.body}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                ref={primaryRef}
                href={copy.primary.href}
                onClick={onClose}
                className="recommend-pulse-once rounded-xl bg-podium-yellow px-6 py-3.5 text-sm font-extrabold text-podium-navy"
              >
                {copy.primary.label}
              </Link>
              {"href" in copy.secondary ? (
                <Link
                  href={copy.secondary.href}
                  onClick={onClose}
                  className="rounded-xl border border-white/15 px-6 py-3.5 text-sm font-bold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
                >
                  {copy.secondary.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/15 px-6 py-3.5 text-sm font-bold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
                >
                  {copy.secondary.label}
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
