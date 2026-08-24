"use client";

import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

/** Marketing-only mock rows — fictional; not real platform or Receita data. */
const LEADS = [
  {
    pos: 1,
    empresa: "Metalúrgica Horizonte",
    cidade: "Joinville · SC",
    telefone: "(47) 3025-8841",
    socio: "Carla Menezes",
    flag: null as string | null,
  },
  {
    pos: 2,
    empresa: "Clínica Aurora Saúde",
    cidade: "Curitiba · PR",
    telefone: "(41) 3332-1900",
    socio: "Rafael Pinho",
    flag: null,
  },
  {
    pos: 3,
    empresa: "Auto Peças Sul",
    cidade: "Caxias do Sul · RS",
    telefone: "(54) 3218-4470",
    socio: "—",
    flag: "Contabilidade",
  },
  {
    pos: 4,
    empresa: "Studio Forma Arquitetura",
    cidade: "Florianópolis · SC",
    telefone: "(48) 3224-6612",
    socio: "Helena Vargas",
    flag: null,
  },
  {
    pos: 5,
    empresa: "Logística Serra Fria",
    cidade: "Blumenau · SC",
    telefone: "(47) 3340-2298",
    socio: "Diego Ramos",
    flag: null,
  },
] as const;

export function LandingListPreview({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(1);
  const current = LEADS.find((l) => l.pos === active) ?? LEADS[0];

  return (
    <div
      className={cn("relative w-full max-w-lg", className)}
      role="region"
      aria-label={COPY.landingPreviewLabel}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(245,179,1,0.14),transparent_68%)]"
      />

      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
        {COPY.landingPreviewLabel}
      </p>

      <ul className="space-y-1.5">
        {LEADS.map((lead, i) => {
          const on = active === lead.pos;
          const pole = lead.pos === 1;
          return (
            <motion.li
              key={lead.pos}
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: reduce ? 0 : 0.2 + i * 0.06,
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
                    ? pole
                      ? "bg-podium-yellow text-podium-navy"
                      : "bg-white/[0.08] text-podium-white"
                    : "bg-transparent text-podium-gray hover:bg-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "w-8 shrink-0 font-extrabold tracking-tight tabular-nums md:w-10 md:text-lg",
                    on && pole
                      ? "text-podium-navy"
                      : on
                        ? "text-podium-yellow"
                        : "text-podium-muted",
                  )}
                >
                  P{lead.pos}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold md:text-base">
                    {lead.empresa}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-xs",
                      on && pole ? "text-podium-navy/70" : "text-podium-muted",
                    )}
                  >
                    {lead.cidade}
                  </span>
                </span>
                {pole ? (
                  <span
                    className={cn(
                      "shrink-0 text-[9px] font-bold uppercase tracking-[0.18em]",
                      on ? "text-podium-navy/80" : "text-podium-yellow",
                    )}
                  >
                    Pole
                  </span>
                ) : null}
              </button>
            </motion.li>
          );
        })}
      </ul>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.pos}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 border-t border-white/10 pt-4"
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                Telefone
              </p>
              <p className="mt-1 font-semibold text-podium-white">
                {current.telefone}
              </p>
              {current.flag ? (
                <p className="mt-0.5 text-xs text-podium-alert">{current.flag}</p>
              ) : null}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-muted">
                Sócio que decide
              </p>
              <p className="mt-1 font-semibold text-podium-white">
                {current.socio}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
