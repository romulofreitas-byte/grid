import { AppShell } from "@/components/AppShell";
import { MetasPage } from "@/components/MetasPage";
import { COPY } from "@/lib/copy";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function MetasRoute() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  return (
    <AppShell title={COPY.calculadoraTitle}>
      <MetasPage />
    </AppShell>
  );
}
