import { MetasPage } from "@/components/MetasPage";
import { GlassCard } from "@/components/GlassCard";
import { requireSession } from "@/lib/auth/session";
import { loadMetasCore } from "@/lib/calculadora/load";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { redirect, unstable_rethrow } from "next/navigation";

export default async function MetasRoute() {
  try {
    const session = await requireSession();
    if (!session) redirect("/entrar");
    const initial = await loadMetasCore(session.id);
    return <MetasPage initial={initial} />;
  } catch (err) {
    unstable_rethrow(err);
    console.error("metas_page_error", err);
    return (
      <GlassCard className="p-3">
        <p className="text-sm font-semibold">Não deu para abrir a Meta.</p>
        <p className="mt-2 text-sm text-podium-gray">
          {userFacingDbBusyMessage(err)}
        </p>
      </GlassCard>
    );
  }
}
