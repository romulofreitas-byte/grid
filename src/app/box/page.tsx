import { BoxPlatformCouponBanner } from "@/components/BoxPlatformCouponBanner";
import { AppShell } from "@/components/AppShell";
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
      <AppShell title="Ligar" fill wide lockHeight tone="light">
        <div className="rounded-lg border border-zinc-200 bg-white p-8">
          <p className="text-lg font-bold text-zinc-900">Não deu para carregar as ligações.</p>
          <p className="mt-3 text-sm text-zinc-600">
            {userFacingDbBusyMessage(err)}
          </p>
        </div>
      </AppShell>
    );
  }
}

async function BoxPageInner() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  const repo = getRepo();
  const profile = await repo.getProfile(session.id);
  const billing = await getBalance(session.id);
  const platformSubscriber = await isPlatformSubscriber(session.email);
  const showPlatformCoupon = shouldShowPlatformCouponBanner(
    platformSubscriber,
    billing.plano,
    { trialExpired: billing.trialExpired },
  );
  const cookieStore = await cookies();
  const workingSearchId =
    cookieStore.get(WORKING_SEARCH_COOKIE)?.value ?? null;
  const [recent, savedPreview, connectionRows, hasCrmPipeline, queue] =
    await Promise.all([
      repo.listRecentSearches(profile.id, { limit: 5 }),
      repo.listSearches(profile.id, { limit: 6 }),
      repo.listIntegrationConnections(session.id),
      repo.hasCrmPipeline(session.id).catch((err) => {
        console.error("box_has_crm_pipeline_error", err);
        return false;
      }),
      loadBoxQueue(session.id).catch((err) => {
        console.error("box_queue_error", err);
        throw err;
      }),
    ]);
  const hasMoreSaved = savedPreview.length > 5;
  const allSaved = hasMoreSaved
    ? await repo.listSearches(profile.id)
    : savedPreview.filter((s) => s.saved);
  const savedCount = allSaved.length;
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
  try {
    const next = await repo.findNextCallLead(session.id, workingSearchId);
    novoSearchId = next?.searchId ?? null;
  } catch (err) {
    console.error("box_next_call_error", err);
  }
  const rawGap =
    estrutura.nextGap != null
      ? (estrutura.slots.find((slot) => slot.id === estrutura.nextGap) ?? null)
      : null;
  const gap = rawGap?.id === "ligar" ? null : rawGap;

  return (
    <AppShell title="Ligar" fill wide lockHeight tone="light">
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
    </AppShell>
  );
}
