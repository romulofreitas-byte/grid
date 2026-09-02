import Link from "next/link";
import { Suspense } from "react";
import { CrmBoard } from "@/components/crm/CrmBoard";
import { CrmBoardSkeleton } from "@/components/crm/CrmBoardSkeleton";
import { GlassCard } from "@/components/GlassCard";
import { requireSession } from "@/lib/auth/session";
import { paywallCopy } from "@/lib/billing/paywall";
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
  const copy = paywallCopy({
    kind: trialExpired ? "trial" : "plan",
    feature: "crm",
  });
  return (
    <GlassCard className="p-8">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
        {copy.eyebrow}
      </p>
      <p className="mt-3 text-base font-semibold">{copy.title}</p>
      <p className="mt-3 text-sm text-podium-gray">{copy.body}</p>
      <Link
        href={copy.primary.href}
        className="mt-6 inline-flex rounded-md bg-podium-yellow px-4 py-2 text-xs font-medium text-podium-navy"
      >
        {copy.primary.label}
      </Link>
      {"href" in copy.secondary ? (
        <Link
          href={copy.secondary.href}
          className="mt-3 ml-3 inline-flex rounded-md border border-white/15 px-4 py-2 text-xs font-medium text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
        >
          {copy.secondary.label}
        </Link>
      ) : null}
    </GlassCard>
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
      <GlassCard className="p-8">
        <p className="text-base font-semibold">Não deu para abrir a pista.</p>
        <p className="mt-3 text-sm text-podium-gray">
          {userFacingDbBusyMessage(err)}
        </p>
      </GlassCard>
    );
  }
}
