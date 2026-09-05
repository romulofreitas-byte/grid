"use client";

import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { useConnections } from "@/hooks/useConnections";
import { integracoesHref } from "@/lib/back";
import {
  CATALOG_SECTIONS,
  catalogAvailability,
  catalogItemsByKind,
  getCatalogItem,
} from "@/lib/integrations/catalog";
import type { IntegrationKind } from "@/lib/integrations/schema";
import { cn } from "@/lib/utils";

function kindSetupHref(kind: IntegrationKind): string | null {
  if (kind === "voip") return integracoesHref("voip");
  if (kind === "dialer") return integracoesHref("dialer");
  if (kind === "webhook") return "/automacoes";
  return null;
}

function statusLabel(status: string): string {
  if (status === "active") return "Ativa";
  if (status === "pending") return "Pendente";
  if (status === "error") return "Erro";
  if (status === "revoked") return "Revogada";
  return status;
}

export default function ContaConexoesPage() {
  const connectionsQuery = useConnections();
  const connections = connectionsQuery.data;

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 md:p-5" hover={false}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-podium-yellow">
          Conexões desta conta
        </p>
        <Hint className="mt-1">
          O setup fica em Integrações. Aqui você vê o que já está ligado.
        </Hint>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <Link href={integracoesHref("voip")} className="text-podium-yellow">
            VoIP
          </Link>
          <span className="text-podium-muted">·</span>
          <Link href={integracoesHref("dialer")} className="text-podium-yellow">
            Discador
          </Link>
          <span className="text-podium-muted">·</span>
          <Link href="/importacoes" className="text-podium-yellow">
            Importações
          </Link>
          <span className="text-podium-muted">·</span>
          <Link href="/automacoes" className="text-podium-yellow">
            Automações
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {connectionsQuery.isLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-white/5" />
          ) : !connections || connections.length === 0 ? (
            <p className="text-sm text-podium-muted">Nenhuma conexão configurada.</p>
          ) : (
            connections.map((row) => {
              const item = getCatalogItem(row.catalog_id);
              const href = kindSetupHref(row.kind);
              const body = (
                <>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-podium-white">
                      {row.display_name || item?.name || row.kind}
                    </span>
                    <span className="text-xs text-podium-muted">
                      {item?.name ?? row.kind} · {statusLabel(row.status)}
                    </span>
                  </span>
                </>
              );
              return href ? (
                <Link
                  key={row.id}
                  href={href}
                  className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 hover:border-podium-yellow/30"
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5"
                >
                  {body}
                </div>
              );
            })
          )}
        </div>
      </GlassCard>

      {CATALOG_SECTIONS.map((section) => {
        const items = catalogItemsByKind(section.kind);
        const setupHref = kindSetupHref(section.kind);
        return (
          <GlassCard key={section.kind} className="p-4 md:p-5" hover={false}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-podium-muted">
              {section.label}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map((item) => {
                const availability = catalogAvailability(item);
                const live = availability === "live";
                const inner = (
                  <div className="flex items-center gap-3">
                    <IntegrationLogo item={item} size="sm" active={live} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-podium-white">
                        {item.name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-[0.12em]",
                          live ? "text-podium-yellow" : "text-podium-muted",
                        )}
                      >
                        {live ? "Disponível" : "Em breve"}
                      </span>
                    </span>
                  </div>
                );
                if (live && setupHref) {
                  return (
                    <Link
                      key={item.id}
                      href={setupHref}
                      className="rounded-xl border border-white/10 px-3 py-2.5 hover:border-podium-yellow/30"
                    >
                      {inner}
                    </Link>
                  );
                }
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 px-3 py-2.5 opacity-70"
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
