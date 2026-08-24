"use client";

import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

const SLOTS = [
  {
    pos: 1,
    label: "POLE",
    t: "Telefone da empresa",
    d: "Avisa quando o número é da contabilidade, não de quem decide.",
  },
  {
    pos: 2,
    label: "GRID DA FRENTE",
    t: "Sócio que decide",
    d: "O nome de quem pode fechar já vem na lista, para a primeira ligação.",
  },
  {
    pos: 3,
    label: "ORDEM",
    t: "Ligue de cima para baixo",
    d: "P1, P2, P3… o GRID já escolheu quem ligar primeiro.",
  },
] as const;

export function LandingBenefits() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(1);

  return (
    <section className="relative border-y border-white/[0.06] bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
            {COPY.landingBenefitsEyebrow}
          </p>
          <h2 className="mt-3 max-w-lg text-2xl font-extrabold tracking-tight text-podium-white md:text-4xl">
            {COPY.landingBenefitsTitle}
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-2 md:mt-16 md:grid-cols-3 md:gap-0">
          {SLOTS.map((slot, i) => {
            const on = active === slot.pos;
            return (
              <motion.button
                key={slot.pos}
                type="button"
                onMouseEnter={() => setActive(slot.pos)}
                onFocus={() => setActive(slot.pos)}
                onClick={() => setActive(slot.pos)}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.45,
                  delay: reduce ? 0 : i * 0.07,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={cn(
                  "relative px-5 py-6 text-left transition duration-300 md:px-7 md:py-8",
                  on ? "bg-podium-yellow/10" : "hover:bg-white/[0.03]",
                  i > 0 && "md:border-l md:border-white/10",
                )}
              >
                {on ? (
                  <span className="absolute inset-x-5 top-0 h-0.5 bg-podium-yellow md:inset-x-0 md:left-0 md:top-auto md:h-auto md:w-1 md:inset-y-0" />
                ) : null}
                <div className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      "font-extrabold text-3xl tracking-tight md:text-4xl",
                      on ? "text-podium-yellow" : "text-podium-muted",
                    )}
                  >
                    P{slot.pos}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-[0.18em]",
                      on ? "text-podium-yellow" : "text-podium-muted",
                    )}
                  >
                    {slot.label}
                  </span>
                </div>
                <h3 className="mt-4 font-bold text-podium-white md:text-lg">
                  {slot.t}
                </h3>
                <p
                  className={cn(
                    "mt-2 text-sm leading-relaxed text-podium-muted transition-opacity duration-300 md:text-base",
                    on ? "opacity-100" : "opacity-70",
                  )}
                >
                  {slot.d}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
