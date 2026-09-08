import { Suspense } from "react";
import Link from "next/link";
import { BoxPlatformCouponBanner } from "@/components/BoxPlatformCouponBanner";
import { BoxSprint } from "@/components/box/BoxSprint";
import { buildBoxEstrutura, type BoxSlot } from "@/lib/box-estrutura";
import { loadBoxQueue } from "@/lib/box/load-queue";
import { getRepo } from "@/lib/data";
import { userFacingDbBusyMessage } from "@/lib/data/pg";
import { requireSession } from "@/lib/auth/session";
import { getBalance } from "@/lib/billing/service";
import type { CreditBalance } from "@/lib/billing/types";
import {
  isPlatformSubscriber,
  shouldShowPlatformCouponBanner,
} from "@/lib/platform/subscribers";
import {
  toPublicConnection,
  type IntegrationConnectionPublic,
} from "@/lib/integrations/records";
import { redirect, unstable_rethrow } from "next/navigation";
import type { Profile } from "@/lib/types";

export default async function BoxPage() {
  try {
    return await BoxPageInner();
  } catch (err) {
    unstable_rethrow(err);
    console.error("box_page_error", err);
    return (
      <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
        <p className="text-sm font-semibold text-podium-white">Não deu para carregar as ligações.</p>
        <p className="mt-2 text-sm text-podium-muted">
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

  const billingPromise = getBalance(session.id);
  const [profile, billing, connectionRows, hasCrmPipeline, queue] =
    await Promise.all([
      repo.getProfile(session.id),
      billingPromise,
      repo.listIntegrationConnections(session.id),
      repo.hasCrmPipeline(session.id).catch((err) => {
        console.error("box_has_crm_pipeline_error", err);
        return false;
      }),
      billingPromise
        .then((balance) =>
          loadBoxQueue(session.id, new Date(), {
            crmAllowed: balance.enrichAllowed,
            trialExpired: balance.trialExpired,
          }),
        )
        .catch((err) => {
          console.error("box_queue_error", err);
          throw err;
        }),
    ]);

  const connections = connectionRows.map((row) => toPublicConnection(row));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <Suspense fallback={null}>
        <BoxDeferredChrome
          userId={session.id}
          email={session.email}
          billing={billing}
          profile={profile}
          connections={connections}
          hasCrmPipeline={hasCrmPipeline}
        />
      </Suspense>
      <BoxSprint
        queue={queue}
        connections={connections}
        novoSearchId={null}
        gap={null}
      />
    </div>
  );
}

async function BoxDeferredChrome({
  userId,
  email,
  billing,
  profile,
  connections,
  hasCrmPipeline,
}: {
  userId: string;
  email: string | null;
  billing: CreditBalance;
  profile: Profile;
  connections: IntegrationConnectionPublic[];
  hasCrmPipeline: boolean;
}) {
  const repo = getRepo();
  const [platformSubscriber, recent, savedPreview] = await Promise.all([
    isPlatformSubscriber(email),
    repo.listRecentSearches(userId, { limit: 5 }),
    repo.listSearches(userId, { limit: 6 }),
  ]);

  const showPlatformCoupon = shouldShowPlatformCouponBanner(
    platformSubscriber,
    billing.plano,
    { trialExpired: billing.trialExpired },
  );
  const unsavedSearch = recent.find((s) => !s.saved) ?? null;
  const estrutura = buildBoxEstrutura({
    savedCount: savedPreview.length,
    hasUnsavedSearch: Boolean(unsavedSearch),
    profile,
    billing,
    connections,
    hasCrmPipeline,
  });
  const rawGap =
    estrutura.nextGap != null
      ? (estrutura.slots.find((slot) => slot.id === estrutura.nextGap) ?? null)
      : null;
  const gap = rawGap?.id === "ligar" ? null : rawGap;

  return (
    <>
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
      {gap ? <BoxGapStrip gap={gap} /> : null}
    </>
  );
}

function BoxGapStrip({ gap }: { gap: BoxSlot }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5">
      <p className="min-w-0 truncate text-xs text-podium-muted">
        <span className="font-medium text-podium-white">{gap.title}</span>
        <span className="hidden sm:inline"> — {gap.body}</span>
      </p>
      <Link
        href={gap.href}
        className="shrink-0 text-xs text-podium-yellow hover:underline"
      >
        {gap.cta}
      </Link>
    </div>
  );
}
