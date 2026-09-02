"use client";

import { COPY } from "@/lib/copy";
import { motion, useReducedMotion } from "framer-motion";

const PAINS = [
  { title: COPY.landingPain1Title, body: COPY.landingPain1Body },
  { title: COPY.landingPain2Title, body: COPY.landingPain2Body },
  { title: COPY.landingPain3Title, body: COPY.landingPain3Body },
] as const;

export function LandingPain() {
  const reduce = useReducedMotion();

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
            {COPY.landingPainEyebrow}
          </p>
          <h2 className="mt-3 max-w-xl text-2xl font-extrabold tracking-tight text-podium-white md:text-4xl">
            {COPY.landingPainTitle}
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3">
          {PAINS.map((pain, i) => (
            <motion.article
              key={pain.title}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.45,
                delay: reduce ? 0 : i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6"
            >
              <span className="text-sm font-extrabold tabular-nums text-podium-yellow">
                0{i + 1}
              </span>
              <h3 className="mt-3 text-lg font-bold text-podium-white">
                {pain.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-podium-muted md:text-base">
                {pain.body}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
