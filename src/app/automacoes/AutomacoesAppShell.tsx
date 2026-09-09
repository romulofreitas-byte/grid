"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { BACK } from "@/lib/back";
import { COPY } from "@/lib/copy";

export function AutomacoesAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title =
    pathname === "/automacoes/avancado"
      ? COPY.integracoesCatAvancado
      : pathname === "/automacoes/meta"
        ? COPY.automacoesMetaTitle
        : COPY.integracoesCatCaptar;
  return (
    <AppShell fill wide lockHeight title={title} back={BACK.integracoes}>
      {children}
    </AppShell>
  );
}
