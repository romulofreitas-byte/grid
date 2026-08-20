import type { ReactNode } from "react";
import Link from "next/link";
import { Cable, Flag, List, Wallet } from "lucide-react";
import { BoxDayCta } from "@/components/BoxDayCta";
import { BoxEstrutura } from "@/components/BoxEstrutura";
import { GlassCard } from "@/components/GlassCard";
import { PilotAvatar } from "@/components/PilotAvatar";
import { VoltaRing } from "@/components/VoltaRing";
import { conexoesHref, largadaNovaHref } from "@/lib/back";
import type { BoxSlot, BoxSlotId } from "@/lib/box-estrutura";
import { COPY } from "@/lib/copy";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";
import type { NextCallLead, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

function GaugeWell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-black/25 px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

const SHORTCUTS = [
  { href: largadaNovaHref, label: COPY.novaLista, icon: Flag },
  { href: "/listas", label: "Listas", icon: List },
  { href: "/planos", label: "Planos", icon: Wallet },
  { href: conexoesHref(), label: "Conexões", icon: Cable },
] as const;

export function BoxCockpit({
  name,
  profile,
  slots,
  defaultOpen,
  unsavedSearch,
  next,
  hoje,
  meta,
  sequencia,
  pistaAberta,
  connections,
  billing,
  savedCount,
}: {
  name: string;
  profile: Pick<Profile, "foto_url" | "como_chama" | "nome">;
  slots: BoxSlot[];
  defaultOpen: BoxSlotId | null;
  unsavedSearch: { id: string; nome: string } | null;
  next: NextCallLead | null;
  hoje: number;
  meta: number;
  sequencia: number;
  pistaAberta: boolean;
  connections: IntegrationConnectionPublic[];
  billing: {
    total: number;
    plan: number;
    pack: number;
    plano: string;
  };
  savedCount: number;
}) {
  return (
    <GlassCard hover={false} highlight={pistaAberta} className="overflow-hidden p-0">
      <BoxEstrutura
        slots={slots}
        defaultOpen={defaultOpen}
        unsavedSearch={unsavedSearch}
      >
        <div className="flex min-w-0 items-center gap-3">
          <PilotAvatar profile={profile} size="md" />
          <div className="min-w-0">
            <p className="text-sm text-podium-gray">Bem-vindo de volta</p>
            <h1 className="mt-0.5 truncate text-2xl font-extrabold md:text-3xl">
              {name}
            </h1>
          </div>
        </div>
      </BoxEstrutura>

      <div className="flex flex-col gap-6 px-5 py-6 md:flex-row md:items-center md:justify-between md:px-6 md:py-8">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
            Trabalho do dia
          </p>
          <h2 className="mt-3 max-w-xl text-3xl font-extrabold leading-tight md:text-4xl">
            {!pistaAberta
              ? COPY.boxPistaFechada
              : next
                ? hoje === 0
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
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <BoxDayCta
              next={next}
              hoje={hoje}
              pistaAberta={pistaAberta}
              unsavedSearch={unsavedSearch}
              connections={connections}
            />
            {next ? (
              <Link
                href={largadaNovaHref}
                className="inline-flex items-center gap-2 text-sm font-bold text-podium-gray hover:text-podium-yellow"
              >
                <Flag className="h-4 w-4" />
                {COPY.novaLista}
              </Link>
            ) : null}
          </div>
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-5",
            !pistaAberta && "opacity-40",
          )}
        >
          <VoltaRing hoje={hoje} meta={meta} muted={!pistaAberta} />
          <div>
            <p className="text-sm text-podium-gray">Sequência</p>
            <p className="mt-1 text-2xl font-extrabold text-podium-yellow">
              {sequencia}
            </p>
            <p className="text-xs text-podium-muted">
              {sequencia === 1 ? "dia na pista" : "dias na pista"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-white/[0.08] bg-black/20 p-2 md:grid-cols-3 md:gap-3 md:p-3">
        <GaugeWell>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
            Acesso
          </p>
          <p className="mt-1 text-3xl font-extrabold text-podium-yellow">
            {billing.total}
          </p>
          <p className="mt-1 text-xs text-podium-muted">
            Plano {billing.plano} · {billing.plan} do plano · {billing.pack} de
            recarga
          </p>
          <Link
            href="/planos"
            className="mt-2 inline-block text-xs font-bold text-podium-yellow hover:underline"
          >
            Planos e recarga →
          </Link>
        </GaugeWell>
        <GaugeWell>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
            Listas salvas
          </p>
          <p className="mt-1 text-3xl font-extrabold">{savedCount}</p>
          <p className="mt-1 text-xs text-podium-muted">
            Só entram depois que você clica em Salvar lista
          </p>
          <Link
            href="/listas"
            className="mt-2 inline-block text-xs font-bold text-podium-yellow hover:underline"
          >
            Ver listas →
          </Link>
        </GaugeWell>
        <GaugeWell className="col-span-2 md:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
            Atalhos
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {SHORTCUTS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-podium-gray hover:bg-white/5 hover:text-podium-yellow"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </GaugeWell>
      </div>
    </GlassCard>
  );
}
