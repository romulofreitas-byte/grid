import { FeatureLockedPage } from "@/components/billing/FeatureLockedPage";
import { GlassCard } from "@/components/GlassCard";
import { AutomacoesPanel } from "@/components/automacoes/AutomacoesPanel";
import { requireSession } from "@/lib/auth/session";
import { planHasFeature } from "@/lib/billing/catalog";
import { getBalance } from "@/lib/billing/service";
import type { AccessHold } from "@/lib/billing/types";
import { ensureDefaultPipeline } from "@/lib/crm/ensure-pipeline";
import type { AutomacoesCategory } from "@/lib/crm/types";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { redirect, unstable_rethrow } from "next/navigation";

function AutomacoesLocked({
  feature,
  trialExpired,
  accessHold,
}: {
  feature: "crm" | "automations";
  trialExpired: boolean;
  accessHold: AccessHold;
}) {
  return (
    <FeatureLockedPage
      feature={feature}
      trialExpired={trialExpired}
      accessHold={feature === "crm" ? accessHold : null}
      from="/integracoes"
    />
  );
}

export async function renderAutomacoes(category: AutomacoesCategory) {
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
          accessHold={balance.accessHold}
        />
      );
    }
    const pipelines = await ensureDefaultPipeline(session.id, listed);
    return (
      <AutomacoesPanel initialPipelines={pipelines} category={category} />
    );
  } catch (err) {
    unstable_rethrow(err);
    console.error("automacoes_page_error", err);
    return (
      <GlassCard className="p-3">
        <p className="text-sm font-semibold">Não deu para abrir Automações.</p>
        <p className="mt-2 text-sm text-podium-gray">
          {userFacingDbBusyMessage(err)}
        </p>
      </GlassCard>
    );
  }
}
