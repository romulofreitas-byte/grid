"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { pagarHref, planosHref } from "@/lib/billing/href";
import { COPY } from "@/lib/copy";

export function BoxPlatformCouponBanner({ ended = false }: { ended?: boolean }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-podium-yellow/40 bg-podium-yellow/10 p-5 md:p-6"
      animate={
        reduce
          ? undefined
          : {
              boxShadow: [
                "0 0 0 0 rgba(245, 179, 1, 0)",
                "0 0 24px 2px rgba(245, 179, 1, 0.35)",
                "0 0 0 0 rgba(245, 179, 1, 0)",
              ],
            }
      }
      transition={
        reduce
          ? undefined
          : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
        Mundo Pódium
      </p>
      <p className="mt-2 text-lg font-extrabold leading-snug text-podium-white">
        {ended ? COPY.boxPlatformTrialEnded : COPY.boxPlatformCoupon}
      </p>
      {ended ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={planosHref("/box", true)}
            className="inline-flex rounded-xl bg-podium-yellow px-5 py-2.5 text-sm font-extrabold text-podium-navy transition hover:brightness-110"
          >
            Recarregar
          </Link>
          <Link
            href={planosHref("/box")}
            className="inline-flex rounded-xl border border-white/15 px-5 py-2.5 text-sm font-extrabold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
          >
            Assinar o Piloto
          </Link>
        </div>
      ) : (
        <Link
          href={pagarHref("membro_plataforma", "/box")}
          className="mt-4 inline-flex rounded-xl bg-podium-yellow px-5 py-2.5 text-sm font-extrabold text-podium-navy transition hover:brightness-110"
        >
          Ativar Piloto
        </Link>
      )}
    </motion.div>
  );
}
