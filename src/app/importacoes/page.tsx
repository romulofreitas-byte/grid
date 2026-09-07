import { AppShell } from "@/components/AppShell";
import { FeatureLockedPage } from "@/components/billing/FeatureLockedPage";
import { GlassCard } from "@/components/GlassCard";
import { ImportacoesPanel } from "@/components/importacoes/ImportacoesPanel";
import { BACK } from "@/lib/back";
import { requireSession } from "@/lib/auth/session";
import { getBalance } from "@/lib/billing/service";
import { COPY } from "@/lib/copy";
import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { redirect, unstable_rethrow } from "next/navigation";

function ImportLocked({ trialExpired }: { trialExpired: boolean }) {
  return (
    <AppShell fill wide lockHeight title={COPY.importacoesTitle} back={BACK.painel}>
      <FeatureLockedPage
        feature="crm"
        trialExpired={trialExpired}
        from="/importacoes"
      />
    </AppShell>
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
    const repo = getRepo();
    let pipelines = listed;
    if (pipelines.length === 0) {
      await repo.createCrmPipeline(session.id, DEFAULT_PIPELINE_NAME);
      pipelines = await repo.listCrmPipelines(session.id);
    }
    return (
      <AppShell fill wide lockHeight title={COPY.importacoesTitle} back={BACK.painel}>
        <ImportacoesPanel initialPipelines={pipelines} />
      </AppShell>
    );
  } catch (err) {
    unstable_rethrow(err);
    console.error("importacoes_page_error", err);
    return (
      <AppShell fill wide lockHeight title={COPY.importacoesTitle} back={BACK.painel}>
        <GlassCard className="p-3">
          <p className="text-sm font-semibold">Não deu para abrir Importações.</p>
          <p className="mt-2 text-sm text-podium-gray">
            {userFacingDbBusyMessage(err)}
          </p>
        </GlassCard>
      </AppShell>
    );
  }
}
