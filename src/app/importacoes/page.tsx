import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { ImportacoesPanel } from "@/components/importacoes/ImportacoesPanel";
import { SectionTitle } from "@/components/SectionTitle";
import { BACK } from "@/lib/back";
import { requireSession } from "@/lib/auth/session";
import { withFrom } from "@/lib/billing/href";
import { paywallCopy } from "@/lib/billing/paywall";
import { getBalance } from "@/lib/billing/service";
import { COPY } from "@/lib/copy";
import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import { pickDefaultCrmPipeline } from "@/lib/crm/bridge";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { redirect, unstable_rethrow } from "next/navigation";

function ImportLocked({ trialExpired }: { trialExpired: boolean }) {
  const copy = paywallCopy({
    kind: trialExpired ? "trial" : "plan",
    feature: "crm",
  });
  return (
    <AppShell title={COPY.importacoesTitle} back={BACK.painel}>
      <GlassCard className="p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          {copy.eyebrow}
        </p>
        <p className="mt-3 text-base font-semibold">{copy.title}</p>
        <p className="mt-3 text-sm text-podium-gray">{copy.body}</p>
        <Link
          href={withFrom(copy.primary.href, "/importacoes")}
          className="mt-6 inline-flex rounded-md bg-podium-yellow px-4 py-2 text-xs font-medium text-podium-navy"
        >
          {copy.primary.label}
        </Link>
      </GlassCard>
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
    const first = pickDefaultCrmPipeline(pipelines) ?? pipelines[0] ?? null;
    const board = first ? await repo.getCrmBoard(session.id, first.id) : null;
    return (
      <AppShell title={COPY.importacoesTitle} back={BACK.painel}>
        <SectionTitle>{COPY.importacoesTitle}</SectionTitle>
        <p className="mt-2 max-w-2xl text-pretty text-sm text-podium-muted">
          {COPY.importacoesLead}
        </p>
        <ImportacoesPanel initialPipelines={pipelines} initialBoard={board} />
      </AppShell>
    );
  } catch (err) {
    unstable_rethrow(err);
    console.error("importacoes_page_error", err);
    return (
      <AppShell title={COPY.importacoesTitle} back={BACK.painel}>
        <GlassCard className="p-8">
          <p className="text-base font-semibold">Não deu para abrir Importações.</p>
          <p className="mt-3 text-sm text-podium-gray">
            {userFacingDbBusyMessage(err)}
          </p>
        </GlassCard>
      </AppShell>
    );
  }
}
