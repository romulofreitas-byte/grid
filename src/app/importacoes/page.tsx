import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { ImportacoesPanel } from "@/components/importacoes/ImportacoesPanel";
import { buttonClassName } from "@/components/ui/Button";
import { BACK } from "@/lib/back";
import { requireSession } from "@/lib/auth/session";
import { withFrom } from "@/lib/billing/href";
import { paywallCopy } from "@/lib/billing/paywall";
import { getBalance } from "@/lib/billing/service";
import { COPY } from "@/lib/copy";
import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { redirect, unstable_rethrow } from "next/navigation";

function ImportLocked({ trialExpired }: { trialExpired: boolean }) {
  const copy = paywallCopy({
    kind: trialExpired ? "trial" : "plan",
    feature: "crm",
  });
  return (
    <AppShell fill wide lockHeight title={COPY.importacoesTitle} back={BACK.painel}>
      <GlassCard className="p-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          {copy.eyebrow}
        </p>
        <p className="mt-2 text-sm font-semibold">{copy.title}</p>
        <p className="mt-2 text-sm text-podium-gray">{copy.body}</p>
        <Link
          href={withFrom(copy.primary.href, "/importacoes")}
          className={buttonClassName({
            variant: "primary",
            size: "md",
            className: "mt-3",
          })}
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
