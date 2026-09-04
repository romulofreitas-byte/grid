"use client";

import { LandingQualifyPreview } from "@/components/landing/LandingQualifyPreview";
import { COPY } from "@/lib/copy";
import { motion, useReducedMotion } from "framer-motion";

export function LandingQualify() {
  const reduce = useReducedMotion();

  return (
    <section
      id="qualificacao"
      className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:py-28"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
            {COPY.landingQualifyEyebrow}
          </p>
          <h2 className="mt-3 max-w-lg text-balance text-2xl font-extrabold tracking-tight text-podium-white md:text-4xl">
            {COPY.landingQualifyTitle}
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-podium-muted md:text-base">
            {COPY.landingQualifyBody}
          </p>
        </motion.div>
        <motion.div
          className="min-w-0 justify-self-stretch lg:justify-self-end"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: reduce ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <LandingQualifyPreview />
        </motion.div>
      </div>
    </section>
  );
}
