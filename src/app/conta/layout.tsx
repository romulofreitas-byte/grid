"use client";

import { AppShell } from "@/components/AppShell";
import { ContaNav } from "@/components/conta/ContaNav";
import { BACK } from "@/lib/back";

export default function ContaLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell fill title="Conta" back={BACK.painel}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <ContaNav />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-2">{children}</div>
      </div>
    </AppShell>
  );
}
