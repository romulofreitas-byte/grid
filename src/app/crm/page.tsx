import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CrmBoard } from "@/components/crm/CrmBoard";
import { GlassCard } from "@/components/GlassCard";
import { requireSession } from "@/lib/auth/session";
import { paywallCopy } from "@/lib/billing/paywall";
import { getBalance } from "@/lib/billing/service";
import { COPY } from "@/lib/copy";
import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import { getRepo } from "@/lib/data";
import { isPoolExhaustedError } from "@/lib/data/pg";
import { redirect, unstable_rethrow } from "next/navigation";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; deal?: string }>;
}) {
  try {
    return await CrmPageInner(await searchParams);
  } catch (err) {
    unstable_rethrow(err);
    console.error("crm_page_error", err);
    return (
      <AppShell title={COPY.crmNav}>
        <GlassCard className="p-8">
          <p className="text-lg font-bold">Não deu para abrir a pista.</p>
          <p className="mt-3 text-sm text-podium-gray">
            {isPoolExhaustedError(err)
              ? "A pista está cheia agora. Tenta de novo em instantes."
              : "Tente de novo em instantes."}
          </p>
        </GlassCard>
      </AppShell>
    );
  }
}

function CrmLocked({ trialExpired }: { trialExpired: boolean }) {
  const copy = paywallCopy({
    kind: trialExpired ? "trial" : "plan",
    feature: "crm",
  });
  return (
    <AppShell title={COPY.crmNav}>
      <GlassCard className="p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
          {copy.eyebrow}
        </p>
        <p className="mt-3 text-lg font-bold">{copy.title}</p>
        <p className="mt-3 text-sm text-podium-gray">{copy.body}</p>
        <Link
          href={copy.primary.href}
          className="mt-6 inline-flex rounded-xl bg-podium-yellow px-6 py-3.5 text-sm font-extrabold text-podium-navy"
        >
          {copy.primary.label}
        </Link>
        {"href" in copy.secondary ? (
          <Link
            href={copy.secondary.href}
            className="mt-3 ml-3 inline-flex rounded-xl border border-white/15 px-6 py-3.5 text-sm font-bold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-white"
          >
            {copy.secondary.label}
          </Link>
        ) : null}
      </GlassCard>
    </AppShell>
  );
}

async function CrmPageInner(sp: { pipeline?: string; deal?: string }) {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  const balance = await getBalance(session.id);
  if (!balance.enrichAllowed) {
    return <CrmLocked trialExpired={balance.trialExpired} />;
  }
  const repo = getRepo();
  let pipelines = await repo.listCrmPipelines(session.id);
  if (pipelines.length === 0) {
    await repo.createCrmPipeline(session.id, DEFAULT_PIPELINE_NAME);
    pipelines = await repo.listCrmPipelines(session.id);
  }
  const requested = sp.pipeline
    ? pipelines.find((pipeline) => pipeline.id === sp.pipeline)
    : null;
  const first = requested ?? pipelines[0];
  const board = first
    ? await repo.getCrmBoard(session.id, first.id)
    : null;

  return (
    <AppShell title={COPY.crmNav} fill wide lockHeight>
      <CrmBoard
        initialPipelines={pipelines}
        initialBoard={board}
        initialDealId={sp.deal}
      />
    </AppShell>
  );
}
