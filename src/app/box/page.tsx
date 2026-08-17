import Link from "next/link";
import { Flag } from "lucide-react";
import { BoxPlatformCouponBanner } from "@/components/BoxPlatformCouponBanner";
import { AppShell } from "@/components/AppShell";
import { BoxDayCta } from "@/components/BoxDayCta";
import { BoxEstrutura } from "@/components/BoxEstrutura";
import { GlassCard } from "@/components/GlassCard";
import { PilotAvatar } from "@/components/PilotAvatar";
import { SaveListButton } from "@/components/SaveListButton";
import { SearchListCard } from "@/components/SearchListCard";
import { SectionTitle } from "@/components/SectionTitle";
import { VoltaRing } from "@/components/VoltaRing";
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
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
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
  );
  const stats = await repo.getPilotStats(session.id);
  const [recent, savedPreview, connectionRows] = await Promise.all([
    repo.listRecentSearches(profile.id, { limit: BOX_PREVIEW_LIMIT }),
    repo.listSearches(profile.id, { limit: BOX_PREVIEW_LIMIT + 1 }),
    repo.listIntegrationConnections(session.id),
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
  });
  const next = estrutura.pistaAberta ? stats.proximaFicha : null;
  const name = displayName(profile);
  const pistaAberta = estrutura.pistaAberta;

  return (
    <AppShell title="Box">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <PilotAvatar profile={profile} size="md" />
          <div>
            <p className="text-sm text-podium-gray">Bem-vindo de volta</p>
            <h1 className="mt-1 text-3xl font-extrabold">{name}</h1>
          </div>
        </div>

        {showPlatformCoupon ? <BoxPlatformCouponBanner /> : null}

        <BoxEstrutura
          slots={estrutura.slots}
          defaultOpen={estrutura.nextGap}
          unsavedSearch={unsavedSearch}
        />

        <GlassCard className="p-8 md:p-10" highlight={pistaAberta}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
                Trabalho do dia
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-extrabold leading-tight md:text-4xl">
                {!pistaAberta
                  ? COPY.boxPistaFechada
                  : next
                    ? stats.hoje === 0
                      ? `Ligar o P${next.gridPosition}`
                      : "Continuar a volta"
                    : "Criar e qualificar lista"}
              </h2>
              <p className="mt-3 max-w-lg text-sm text-podium-gray md:text-base">
                {!pistaAberta
                  ? COPY.boxSemLista
                  : next
                    ? `${next.nome}. Ligar conta a volta.`
                    : "A lista salva não tem P novo. Monte outra ou volte no grid."}
              </p>
              <BoxDayCta
                next={next}
                hoje={stats.hoje}
                pistaAberta={pistaAberta}
                unsavedSearch={unsavedSearch}
                connections={connections}
              />
              {next ? (
                <Link
                  href={largadaNovaHref}
                  className="mt-4 ml-0 inline-flex items-center gap-2 text-sm font-bold text-podium-gray hover:text-podium-yellow md:ml-4"
                >
                  <Flag className="h-4 w-4" />
                  {COPY.novaLista}
                </Link>
              ) : null}
            </div>
            <div
              className={cn(
                "flex items-center gap-5",
                !pistaAberta && "opacity-40",
              )}
            >
              <VoltaRing
                hoje={stats.hoje}
                meta={stats.meta}
                muted={!pistaAberta}
              />
              <div>
                <p className="text-sm text-podium-gray">Sequência</p>
                <p className="mt-1 text-2xl font-extrabold text-podium-yellow">
                  {stats.sequencia}
                </p>
                <p className="text-xs text-podium-muted">
                  {stats.sequencia === 1
                    ? "dia na pista"
                    : "dias na pista"}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-4 md:grid-cols-2">
          <GlassCard className="p-5">
            <p className="text-sm text-podium-gray">Créditos</p>
            <p className="mt-2 text-4xl font-extrabold text-podium-yellow">
              {billing.total}
            </p>
            <p className="mt-1 text-xs text-podium-muted">
              Plano {billing.plano} · {billing.plan} do plano · {billing.pack} de
              recarga
            </p>
            <Link
              href="/planos"
              className="mt-3 inline-block text-xs font-bold text-podium-yellow hover:underline"
            >
              Planos e recarga →
            </Link>
          </GlassCard>
          <GlassCard className="p-5">
            <p className="text-sm text-podium-gray">Listas salvas</p>
            <p className="mt-2 text-4xl font-extrabold">{savedCount}</p>
            <p className="mt-1 text-xs text-podium-muted">
              Só entram depois que você clica em Salvar lista
            </p>
            <Link
              href="/listas"
              className="mt-3 inline-block text-xs font-bold text-podium-yellow hover:underline"
            >
              Ver listas →
            </Link>
          </GlassCard>
        </div>

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
