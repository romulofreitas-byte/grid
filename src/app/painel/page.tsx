import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { PainelDashboard } from "@/app/painel/_components/PainelDashboard";
import { COPY } from "@/lib/copy";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function PainelPage() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  return (
    <AppShell title={COPY.painelTitle}>
      <Suspense
        fallback={<p className="text-sm text-podium-muted">Carregando…</p>}
      >
        <PainelDashboard />
      </Suspense>
    </AppShell>
  );
}
