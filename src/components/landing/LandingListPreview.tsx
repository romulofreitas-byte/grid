"use client";

import { LANDING_LEADS } from "@/components/landing/demo-leads";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export function LandingListPreview({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(reduce ? LANDING_LEADS.length : 0);
  const [ready, setReady] = useState(Boolean(reduce));
  const [active, setActive] = useState(1);
  const current =
    LANDING_LEADS.find((l) => l.pos === active) ?? LANDING_LEADS[0];
  const fade = {
    duration: reduce ? 0 : 0.2,
    ease: [0.16, 1, 0.3, 1] as const,
  };

  useEffect(() => {
    if (reduce) return;
    const timers: number[] = [];
    LANDING_LEADS.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => setVisibleCount(i + 1), 280 + i * 160),
      );
    });
    timers.push(
      window.setTimeout(
        () => setReady(true),
        280 + LANDING_LEADS.length * 160 + 120,
      ),
    );
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [reduce]);

  return (
    <div
      className={cn(
        "relative w-full max-w-lg rounded-2xl border border-white/10 bg-podium-panel/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md md:p-5",
        className,
      )}
      role="region"
      aria-label={COPY.landingPreviewLabel}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(245,179,1,0.14),transparent_68%)]"
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
          {COPY.landingPreviewLabel}
        </p>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.14em]",
            ready ? "text-podium-success" : "text-podium-yellow",
          )}
        >
          {ready ? COPY.landingPreviewReady : COPY.landingPreviewBuilding}
        </span>
      </div>

      <div className="mb-3 inline-flex items-center rounded-full border border-podium-yellow/30 bg-podium-yellow/10 px-3 py-1 text-xs font-semibold text-podium-yellow">
        {COPY.landingPreviewFilter}
      </div>

      <ul className="space-y-1.5">
        {LANDING_LEADS.slice(0, visibleCount).map((lead, i) => {
          const on = active === lead.pos;
          return (
            <motion.li
              key={lead.pos}
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.35,
                delay: reduce ? 0 : 0.02 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <button
                type="button"
                onMouseEnter={() => setActive(lead.pos)}
                onFocus={() => setActive(lead.pos)}
                onClick={() => setActive(lead.pos)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition duration-300 md:gap-4 md:px-4 md:py-3",
                  on
                    ? "bg-podium-yellow text-podium-navy"
                    : "bg-white/[0.04] text-podium-gray hover:bg-white/[0.07]",
                )}
              >
                <span
                  className={cn(
                    "w-6 shrink-0 font-extrabold tabular-nums md:w-7",
                    on ? "text-podium-navy" : "text-podium-muted",
                  )}
                >
                  {lead.pos}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold md:text-base">
                    {lead.empresa}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-xs",
                      on ? "text-podium-navy/70" : "text-podium-muted",
                    )}
                  >
                    {lead.cidade}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>

      {visibleCount > 0 ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                Telefone
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={current.telefone}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={fade}
                  className="mt-1 font-semibold text-podium-white"
                >
                  {current.telefone}
                </motion.p>
              </AnimatePresence>
              <div className="relative mt-0.5 min-h-4">
                <AnimatePresence initial={false}>
                  {current.flag ? (
                    <motion.p
                      key={current.flag}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduce ? undefined : { opacity: 0 }}
                      transition={fade}
                      className="absolute inset-x-0 top-0 text-xs text-podium-alert"
                    >
                      {current.flag}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                Sócio que decide
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={current.socio}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={fade}
                  className="mt-1 font-semibold text-podium-white"
                >
                  {current.socio}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 h-16 animate-pulse rounded-lg bg-white/[0.04]" />
      )}
    </div>
  );
}
