"use client";

import Link from "next/link";
import { COPY } from "@/lib/copy";
import { INTEGRACOES_TELEFONIA } from "@/lib/back";
import { cn } from "@/lib/utils";

export type IntegracoesChipCurrent = "conectar" | "captar" | "avancado";

function HubBadge({
  href,
  current,
  children,
}: {
  href: string;
  current?: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide transition",
        current
          ? "border-podium-yellow/40 bg-podium-yellow/10 text-podium-yellow"
          : "border-white/10 bg-white/5 text-podium-gray hover:border-podium-yellow/35 hover:text-podium-yellow",
      )}
    >
      {children}
    </Link>
  );
}

export function IntegracoesCategoryChips({
  current,
}: {
  current: IntegracoesChipCurrent;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <HubBadge href="/integracoes" current={current === "conectar"}>
        {COPY.integracoesCatConectar}
      </HubBadge>
      <HubBadge href="/automacoes" current={current === "captar"}>
        {COPY.integracoesCatCaptar}
      </HubBadge>
      <HubBadge href="/automacoes/avancado" current={current === "avancado"}>
        {COPY.integracoesCatAvancado}
      </HubBadge>
      <HubBadge href="/importacoes">{COPY.importacoesTitle}</HubBadge>
      <HubBadge href={INTEGRACOES_TELEFONIA}>{COPY.telefoniaTitle}</HubBadge>
    </div>
  );
}
