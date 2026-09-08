import { Suspense } from "react";
import { PainelDashboard } from "@/app/painel/_components/PainelDashboard";
import { WorkOpeningSkeleton } from "@/components/WorkOpeningSkeleton";
import { COPY } from "@/lib/copy";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function PainelPage() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  return (
    <Suspense fallback={<WorkOpeningSkeleton label={COPY.painelOpening} />}>
      <PainelDashboard />
    </Suspense>
  );
}
