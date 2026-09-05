import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { AutomacoesPanel } from "@/components/automacoes/AutomacoesPanel";
import { SectionTitle } from "@/components/SectionTitle";
import { BACK } from "@/lib/back";
import { requireSession } from "@/lib/auth/session";
import { withFrom } from "@/lib/billing/href";
import { planHasFeature } from "@/lib/billing/catalog";
import { paywallCopy } from "@/lib/billing/paywall";
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
  const copy = paywallCopy({
    kind: trialExpired && feature === "crm" ? "trial" : "plan",
    feature,
  });
  return (
    <AppShell title={COPY.automacoesTitle} back={BACK.painel}>
      <GlassCard className="p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
          {copy.eyebrow}
        </p>
        <p className="mt-3 text-base font-semibold">{copy.title}</p>
        <p className="mt-3 text-sm text-podium-gray">{copy.body}</p>
        <Link
          href={withFrom(copy.primary.href, "/automacoes")}
          className="mt-6 inline-flex rounded-md bg-podium-yellow px-4 py-2 text-xs font-medium text-podium-navy"
        >
          {copy.primary.label}
        </Link>
      </GlassCard>
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
      <AppShell title={COPY.automacoesTitle} back={BACK.painel}>
        <SectionTitle>{COPY.automacoesTitle}</SectionTitle>
        <p className="mt-2 max-w-2xl text-pretty text-sm text-podium-muted">
          {COPY.automacoesLead}
        </p>
        <AutomacoesPanel initialPipelines={pipelines} />
      </AppShell>
    );
  } catch (err) {
    unstable_rethrow(err);
    console.error("automacoes_page_error", err);
    return (
      <AppShell title={COPY.automacoesTitle} back={BACK.painel}>
        <GlassCard className="p-8">
          <p className="text-base font-semibold">Não deu para abrir Automações.</p>
          <p className="mt-3 text-sm text-podium-gray">
            {userFacingDbBusyMessage(err)}
          </p>
        </GlassCard>
      </AppShell>
    );
  }
}
