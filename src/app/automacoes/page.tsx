import { AppShell } from "@/components/AppShell";
import { FeatureLockedPage } from "@/components/billing/FeatureLockedPage";
import { GlassCard } from "@/components/GlassCard";
import { AutomacoesPanel } from "@/components/automacoes/AutomacoesPanel";
import { BACK } from "@/lib/back";
import { requireSession } from "@/lib/auth/session";
import { planHasFeature } from "@/lib/billing/catalog";
import { getBalance } from "@/lib/billing/service";
import { COPY } from "@/lib/copy";
import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { redirect, unstable_rethrow } from "next/navigation";

function AutomacoesLocked({
  feature,
  trialExpired,
}: {
  feature: "crm" | "automations";
  trialExpired: boolean;
}) {
  return (
    <AppShell fill wide lockHeight title={COPY.automacoesTitle} back={BACK.painel}>
      <FeatureLockedPage
        feature={feature}
        trialExpired={trialExpired}
        from="/automacoes"
      />
    </AppShell>
  );
}

export default async function AutomacoesPage() {
  try {
    const session = await requireSession();
    if (!session) redirect("/entrar");
    const [balance, listed] = await Promise.all([
      getBalance(session.id),
      getRepo().listCrmPipelines(session.id),
    ]);
    if (!planHasFeature(balance.plano, "automations")) {
      return (
        <AutomacoesLocked
          feature={balance.enrichAllowed ? "automations" : "crm"}
          trialExpired={balance.trialExpired}
        />
      );
    }
    const repo = getRepo();
    let pipelines = listed;
    if (pipelines.length === 0) {
      await repo.createCrmPipeline(session.id, DEFAULT_PIPELINE_NAME);
      pipelines = await repo.listCrmPipelines(session.id);
    }
    return (
      <AppShell fill wide lockHeight title={COPY.automacoesTitle} back={BACK.painel}>
        <AutomacoesPanel initialPipelines={pipelines} />
      </AppShell>
    );
  } catch (err) {
    unstable_rethrow(err);
    console.error("automacoes_page_error", err);
    return (
      <AppShell fill wide lockHeight title={COPY.automacoesTitle} back={BACK.painel}>
        <GlassCard className="p-3">
          <p className="text-sm font-semibold">Não deu para abrir Automações.</p>
          <p className="mt-2 text-sm text-podium-gray">
            {userFacingDbBusyMessage(err)}
          </p>
        </GlassCard>
      </AppShell>
    );
  }
}
