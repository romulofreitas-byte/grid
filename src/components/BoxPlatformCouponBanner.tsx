"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { pagarHref, planosHref } from "@/lib/billing/href";
import { COPY } from "@/lib/copy";
import { buttonClassName } from "@/components/ui/Button";

export function BoxPlatformCouponBanner({ ended = false }: { ended?: boolean }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="relative overflow-hidden rounded-md border border-podium-yellow/40 bg-podium-yellow/10 p-3"
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
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
        Mundo Pódium
      </p>
      <p className="mt-2 text-pretty text-sm font-semibold leading-snug text-podium-white">
        {ended ? COPY.boxPlatformTrialEnded : COPY.boxPlatformCoupon}
      </p>
      {ended ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={planosHref("/box")}
            className={buttonClassName({ variant: "primary", size: "md" })}
          >
            Assinar o Piloto
          </Link>
          <Link
            href={planosHref("/box", true)}
            className={buttonClassName({ variant: "secondary", size: "md" })}
          >
            Recarregar créditos
          </Link>
        </div>
      ) : (
        <Link
          href={pagarHref("membro_plataforma", "/box")}
          className={buttonClassName({ variant: "primary", size: "md", className: "mt-3" })}
        >
          Ativar com cupom
        </Link>
      )}
    </motion.div>
  );
}
