import { FeatureLockedPage } from "@/components/billing/FeatureLockedPage";
import { GlassCard } from "@/components/GlassCard";
import { ImportacoesPanel } from "@/components/importacoes/ImportacoesPanel";
import { requireSession } from "@/lib/auth/session";
import { getBalance } from "@/lib/billing/service";
import { ensureDefaultPipeline } from "@/lib/crm/ensure-pipeline";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { redirect, unstable_rethrow } from "next/navigation";

function ImportLocked({ trialExpired }: { trialExpired: boolean }) {
  return (
    <FeatureLockedPage
      feature="crm"
      trialExpired={trialExpired}
      from="/importacoes"
    />
  );
}

export default async function ImportacoesPage() {
  try {
    const session = await requireSession();
    if (!session) redirect("/entrar");
    const [balance, listed] = await Promise.all([
      getBalance(session.id),
      getRepo().listCrmPipelines(session.id),
    ]);
    if (!balance.enrichAllowed) {
      return <ImportLocked trialExpired={balance.trialExpired} />;
    }
    const pipelines = await ensureDefaultPipeline(session.id, listed);
    return <ImportacoesPanel initialPipelines={pipelines} />;
  } catch (err) {
    unstable_rethrow(err);
    console.error("importacoes_page_error", err);
    return (
      <GlassCard className="p-3">
        <p className="text-sm font-semibold">Não deu para abrir Importações.</p>
        <p className="mt-2 text-sm text-podium-gray">
          {userFacingDbBusyMessage(err)}
        </p>
      </GlassCard>
    );
  }
}
