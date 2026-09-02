"use client";

import { COPY } from "@/lib/copy";
import { motion, useReducedMotion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: COPY.landingHowStep1Title,
    body: COPY.landingHowStep1Body,
  },
  {
    n: "02",
    title: COPY.landingHowStep2Title,
    body: COPY.landingHowStep2Body,
  },
  {
    n: "03",
    title: COPY.landingHowStep3Title,
    body: COPY.landingHowStep3Body,
  },
] as const;

export function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <section
      id="como-funciona"
      className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:py-28"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
          {COPY.landingHowEyebrow}
        </p>
        <h2 className="mt-3 max-w-lg text-2xl font-extrabold tracking-tight text-podium-white md:text-4xl">
          {COPY.landingHowTitle}
        </h2>
      </motion.div>

      <ol className="relative mt-12 space-y-0 md:mt-16">
        <div
          aria-hidden
          className="absolute bottom-2 left-[1.15rem] top-2 w-px bg-gradient-to-b from-podium-yellow via-white/20 to-transparent md:left-[1.4rem]"
        />
        {STEPS.map((step, i) => (
          <motion.li
            key={step.n}
            className="relative flex gap-5 pb-12 last:pb-0 md:gap-8 md:pb-16"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.45,
              delay: reduce ? 0 : i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-podium-yellow/50 bg-podium-navy text-xs font-extrabold text-podium-yellow md:h-11 md:w-11 md:text-sm">
              {step.n}
            </span>
            <div className="min-w-0 pt-1 md:pt-2">
              <h3 className="text-lg font-bold text-podium-white md:text-xl">
                {step.title}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-podium-muted md:text-base">
                {step.body}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>

      <motion.p
        className="mt-10 max-w-xl text-sm leading-relaxed text-podium-muted/80 md:mt-12"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {COPY.landingMeiNote}
      </motion.p>
    </section>
  );
}
