import { AppShell } from "@/components/AppShell";
import { CalculadoraPage } from "@/components/CalculadoraPage";
import { COPY } from "@/lib/copy";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CalculadoraRoute() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  return (
    <AppShell title={COPY.calculadoraTitle}>
      <CalculadoraPage />
    </AppShell>
  );
}
