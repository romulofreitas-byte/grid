"use client";

import Link from "next/link";
import { pagarHref, planosHref } from "@/lib/billing/href";
import { COPY } from "@/lib/copy";
import { buttonClassName } from "@/components/ui/Button";

export function BoxPlatformCouponBanner({ ended = false }: { ended?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-podium-yellow/40 bg-podium-yellow/10 p-2.5 shadow-[0_0_0_1px_rgba(245,179,1,0.12)] md:p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
        Mundo Pódium
      </p>
      <p className="mt-1 text-pretty text-sm font-semibold leading-snug text-podium-white md:mt-2">
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
    </div>
  );
}
