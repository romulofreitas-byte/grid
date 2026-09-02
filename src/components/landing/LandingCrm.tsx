"use client";

import { LandingCrmPreview } from "@/components/landing/LandingCrmPreview";
import { COPY } from "@/lib/copy";
import { motion, useReducedMotion } from "framer-motion";

export function LandingCrm() {
  const reduce = useReducedMotion();

  return (
    <section
      id="crm"
      className="relative scroll-mt-20 border-y border-white/[0.06] bg-white/[0.02]"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
              {COPY.landingCrmEyebrow}
            </p>
            <h2 className="mt-3 max-w-lg text-2xl font-extrabold tracking-tight text-podium-white md:text-4xl">
              {COPY.landingCrmTitle}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-podium-muted md:text-base">
              {COPY.landingCrmBody}
            </p>
          </motion.div>
          <motion.div
            className="min-w-0"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.5,
              delay: reduce ? 0 : 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <LandingCrmPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
