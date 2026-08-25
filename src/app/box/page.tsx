import Link from "next/link";
import { BoxPlatformCouponBanner } from "@/components/BoxPlatformCouponBanner";
import { AppShell } from "@/components/AppShell";
import { BoxCockpit } from "@/components/BoxCockpit";
import { GlassCard } from "@/components/GlassCard";
import { SaveListButton } from "@/components/SaveListButton";
import { SearchListCard } from "@/components/SearchListCard";
import { SectionTitle } from "@/components/SectionTitle";
import { gridHref, largadaEditHref, largadaNovaHref } from "@/lib/back";
import { buildBoxEstrutura } from "@/lib/box-estrutura";
import { getRepo } from "@/lib/data";
import { requireSession } from "@/lib/auth/session";
import { getBalance } from "@/lib/billing/service";
import {
  isPlatformSubscriber,
  shouldShowPlatformCouponBanner,
} from "@/lib/platform/subscribers";
import { needsHelmetSetup, displayName } from "@/lib/pilot-profile";
import { toPublicConnection } from "@/lib/integrations/records";
import { COPY } from "@/lib/copy";
import { redirect, unstable_rethrow } from "next/navigation";
import type { Search } from "@/lib/types";

const BOX_PREVIEW_LIMIT = 5;

function BoxSearchCard({
  search,
  from,
}: {
  search: Search;
  from: "box";
}) {
  return (
    <SearchListCard
      search={search}
      from={from}
      unsaved={!search.saved}
      actions={
        <>
          {search.saved ? null : (
            <SaveListButton searchId={search.id} nome={search.nome} />
          )}
          <Link
            href={gridHref(search.id, from)}
            className={
              search.saved
                ? "rounded-xl bg-podium-yellow px-3 py-2 text-xs font-bold text-podium-navy"
                : "rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
            }
          >
            Abrir grid
          </Link>
          <Link
            href={largadaEditHref(search.id, from)}
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
          >
            {COPY.ajustar}
          </Link>
        </>
      }
    />
  );
}

export default async function BoxPage() {
  try {
    return await BoxPageInner();
  } catch (err) {
    unstable_rethrow(err);
    console.error("box_page_error", err);
    return (
      <AppShell title="Box">
        <GlassCard className="p-8">
          <p className="text-lg font-bold">Não deu para carregar o Box.</p>
          <p className="mt-3 text-sm text-podium-gray">
            Tente de novo em instantes.
          </p>
        </GlassCard>
      </AppShell>
    );
  }
}

async function BoxPageInner() {
  const session = await requireSession();
  if (!session) redirect("/entrar");
  const repo = getRepo();
  const profile = await repo.getProfile(session.id);
  if (needsHelmetSetup(profile)) redirect("/setup");
  const billing = await getBalance(session.id);
  const platformSubscriber = await isPlatformSubscriber(session.email);
  const showPlatformCoupon = shouldShowPlatformCouponBanner(
    platformSubscriber,
    billing.plano,
    { trialExpired: billing.trialExpired },
  );
  const stats = await repo.getPilotStats(session.id);
  const [recent, savedPreview, connectionRows, hasCrmPipeline] = await Promise.all([
    repo.listRecentSearches(profile.id, { limit: BOX_PREVIEW_LIMIT }),
    repo.listSearches(profile.id, { limit: BOX_PREVIEW_LIMIT + 1 }),
    repo.listIntegrationConnections(session.id),
    repo.hasCrmPipeline(session.id),
  ]);
  const hasMoreSaved = savedPreview.length > BOX_PREVIEW_LIMIT;
  const savedCount = hasMoreSaved
    ? (await repo.listSearches(profile.id)).length
    : savedPreview.filter((s) => s.saved).length;
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
  const next = estrutura.pistaAberta ? stats.proximaFicha : null;
  const name = displayName(profile);

  return (
    <AppShell title="Box">
      <div className="flex flex-col gap-8">
        {showPlatformCoupon ? <BoxPlatformCouponBanner /> : null}
        {billing.trialExpired ? (
          <BoxPlatformCouponBanner ended />
        ) : null}

        <BoxCockpit
          name={name}
          profile={profile}
          slots={estrutura.slots}
          defaultOpen={estrutura.nextGap}
          unsavedSearch={unsavedSearch}
          next={next}
          hoje={stats.hoje}
          meta={stats.meta}
          sequencia={stats.sequencia}
          pistaAberta={estrutura.pistaAberta}
          connections={connections}
          billing={billing}
          savedCount={savedCount}
        />

        <section>
          <SectionTitle>Última busca</SectionTitle>
          <div className="mt-4 space-y-3">
            {recent.length === 0 ? (
              <GlassCard className="p-5 text-sm text-podium-muted">
                Nenhuma busca ainda. Comece uma{" "}
                <Link href={largadaNovaHref} className="text-podium-yellow">
                  {COPY.novaLista.toLowerCase()}
                </Link>
                .
              </GlassCard>
            ) : (
              recent.slice(0, 1).map((s) => (
                <BoxSearchCard key={s.id} search={s} from="box" />
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
