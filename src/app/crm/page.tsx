import { Suspense } from "react";
import { CrmBoard } from "@/components/crm/CrmBoard";
import { CrmBoardSkeleton } from "@/components/crm/CrmBoardSkeleton";
import { FeatureLockedPage } from "@/components/billing/FeatureLockedPage";
import { GlassCard } from "@/components/GlassCard";
import { requireSession } from "@/lib/auth/session";
import { getBalance } from "@/lib/billing/service";
import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import { pickDefaultCrmPipeline } from "@/lib/crm/bridge";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { redirect, unstable_rethrow } from "next/navigation";

export default function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; deal?: string }>;
}) {
  return (
    <Suspense fallback={<CrmBoardSkeleton opening />}>
      <CrmPageInner searchParams={searchParams} />
    </Suspense>
  );
}

function CrmLocked({ trialExpired }: { trialExpired: boolean }) {
  return (
    <FeatureLockedPage feature="crm" trialExpired={trialExpired} from="/crm" />
  );
}

async function CrmPageInner({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; deal?: string }>;
}) {
  try {
    const sp = await searchParams;
    const session = await requireSession();
    if (!session) redirect("/entrar");
    const [balance, listed] = await Promise.all([
      getBalance(session.id),
      getRepo().listCrmPipelines(session.id),
    ]);
    if (!balance.enrichAllowed) {
      return <CrmLocked trialExpired={balance.trialExpired} />;
    }
    const repo = getRepo();
    let pipelines = listed;
    if (pipelines.length === 0) {
      await repo.createCrmPipeline(session.id, DEFAULT_PIPELINE_NAME);
      pipelines = await repo.listCrmPipelines(session.id);
    }
    const requested = sp.pipeline
      ? pipelines.find((pipeline) => pipeline.id === sp.pipeline)
      : null;
    const first = requested ?? pickDefaultCrmPipeline(pipelines) ?? null;
    const board = first
      ? await repo.getCrmBoard(session.id, first.id)
      : null;

    return (
      <CrmBoard
        initialPipelines={pipelines}
        initialBoard={board}
        initialDealId={sp.deal}
      />
    );
  } catch (err) {
    unstable_rethrow(err);
    console.error("crm_page_error", err);
    return (
      <GlassCard className="p-3">
        <p className="text-sm font-semibold">Não deu para abrir o CRM.</p>
        <p className="mt-2 text-sm text-podium-gray">
          {userFacingDbBusyMessage(err)}
        </p>
      </GlassCard>
    );
  }
}
