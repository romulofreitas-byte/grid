import { AppShell } from "@/components/AppShell";
import { CrmBoard } from "@/components/crm/CrmBoard";
import { GlassCard } from "@/components/GlassCard";
import { requireSession } from "@/lib/auth/session";
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

async function CrmPageInner(sp: { pipeline?: string; deal?: string }) {
  const session = await requireSession();
  if (!session) redirect("/entrar");
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
    <AppShell title={COPY.crmNav} fill wide>
      <CrmBoard
        initialPipelines={pipelines}
        initialBoard={board}
        initialDealId={sp.deal}
      />
    </AppShell>
  );
}
