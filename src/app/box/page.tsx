import { BoxPlatformCouponBanner } from "@/components/BoxPlatformCouponBanner";
import { BoxSprint } from "@/components/box/BoxSprint";
import { buildBoxEstrutura } from "@/lib/box-estrutura";
import { loadBoxQueue } from "@/lib/box/load-queue";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { requireSession } from "@/lib/auth/session";
import { getBalance } from "@/lib/billing/service";
import {
  isPlatformSubscriber,
  shouldShowPlatformCouponBanner,
} from "@/lib/platform/subscribers";
import { toPublicConnection } from "@/lib/integrations/records";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { WORKING_SEARCH_COOKIE } from "@/lib/working-search";

export default async function BoxPage() {
  try {
    return await BoxPageInner();
  } catch (err) {
    unstable_rethrow(err);
    console.error("box_page_error", err);
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-8">
        <p className="text-lg font-bold text-podium-white">Não deu para carregar as ligações.</p>
        <p className="mt-3 text-sm text-podium-muted">
          {userFacingDbBusyMessage(err)}
        </p>
      </div>
    );
  }
}

async function BoxPageInner() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  const repo = getRepo();
  const cookieStore = await cookies();
  const workingSearchId =
    cookieStore.get(WORKING_SEARCH_COOKIE)?.value ?? null;

  const billingPromise = getBalance(session.id);
  const [
    profile,
    billing,
    platformSubscriber,
    recent,
    savedPreview,
    connectionRows,
    hasCrmPipeline,
    queue,
  ] = await Promise.all([
    repo.getProfile(session.id),
    billingPromise,
    isPlatformSubscriber(session.email),
    repo.listRecentSearches(session.id, { limit: 5 }),
    repo.listSearches(session.id, { limit: 6 }),
    repo.listIntegrationConnections(session.id),
    repo.hasCrmPipeline(session.id).catch((err) => {
      console.error("box_has_crm_pipeline_error", err);
      return false;
    }),
    billingPromise.then((balance) =>
      loadBoxQueue(session.id, new Date(), {
        crmAllowed: balance.enrichAllowed,
        trialExpired: balance.trialExpired,
      }),
    ).catch((err) => {
      console.error("box_queue_error", err);
      throw err;
    }),
  ]);

  const showPlatformCoupon = shouldShowPlatformCouponBanner(
    platformSubscriber,
    billing.plano,
    { trialExpired: billing.trialExpired },
  );
  const savedCount = savedPreview.length;
  const connections = connectionRows.map((row) => toPublicConnection(row));
  const unsavedSearch = recent.find((s) => !s.saved) ?? null;
  const estrutura = buildBoxEstrutura({
    savedCount,
    hasUnsavedSearch: Boolean(unsavedSearch),
    profile,
    billing,
    connections,
    hasCrmPipeline,
  });
  let novoSearchId: string | null = null;
  if (queue.counts.total === 0) {
    try {
      const next = await repo.findNextCallLead(session.id, workingSearchId);
      novoSearchId = next?.searchId ?? null;
    } catch (err) {
      console.error("box_next_call_error", err);
    }
  }
  const rawGap =
    estrutura.nextGap != null
      ? (estrutura.slots.find((slot) => slot.id === estrutura.nextGap) ?? null)
      : null;
  const gap = rawGap?.id === "ligar" ? null : rawGap;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {showPlatformCoupon ? (
        <div className="shrink-0 overflow-hidden rounded-lg bg-podium-navy">
          <BoxPlatformCouponBanner />
        </div>
      ) : null}
      {billing.trialExpired ? (
        <div className="shrink-0 overflow-hidden rounded-lg bg-podium-navy">
          <BoxPlatformCouponBanner ended />
        </div>
      ) : null}
      <BoxSprint
        queue={queue}
        connections={connections}
        novoSearchId={novoSearchId}
        gap={gap}
      />
    </div>
  );
}
