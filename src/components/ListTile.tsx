"use client";

import { BookmarkMinus, BookmarkPlus } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { ListSearchMenu } from "@/components/ListSearchMenu";
import { ListSummaryBadges } from "@/components/ListSummaryBadges";
import { COPY } from "@/lib/copy";
import { formatRelativeShort } from "@/lib/format";
import { gridHref, type GridFrom } from "@/lib/back";
import type { Search } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

const iconActionClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border disabled:opacity-40";

export function ListTile({
  search,
  from,
  unsaved,
  error,
  pistaNome,
  pending,
  onToggleSaved,
  onDeleted,
}: {
  search: Search;
  from: GridFrom;
  unsaved?: boolean;
  error?: string | null;
  pistaNome?: string | null;
  pending?: boolean;
  onToggleSaved: (saved: boolean) => void;
  onDeleted: (searchId: string) => void;
}) {
  const leads = search.total_found ?? 0;
  const leadLabel = leads === 1 ? COPY.listasLeadOne : COPY.listasLeadMany;
  const href = gridHref(search.id, from);

  return (
    <GlassCard
      highlight={!unsaved}
      className={cn(
        "group relative flex h-full flex-col p-3",
        unsaved &&
          "border-dashed border-white/15 bg-white/[0.02] hover:border-white/25",
      )}
    >
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`Abrir lista ${search.nome}`}
      />
      <div className="pointer-events-none relative z-[1] flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {unsaved ? (
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
                {COPY.listasRascunho}
              </p>
            ) : null}
            <p
              className={cn(
                "truncate text-sm font-semibold leading-snug",
                unsaved ? "mt-0.5 text-podium-gray" : "text-podium-white",
              )}
            >
              {search.nome}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md border px-2 py-1 text-right text-xs font-semibold tabular-nums",
              unsaved
                ? "border-white/10 text-podium-muted"
                : "border-white/10 text-podium-gray",
            )}
          >
            {leads.toLocaleString("pt-BR")}{" "}
            <span className="font-medium text-podium-muted">{leadLabel}</span>
          </span>
        </div>
        <ListSummaryBadges filters={search.filtros} className="mt-2" />
        {pistaNome ? (
          <p className="mt-1.5 truncate text-[11px] text-podium-muted">
            {COPY.crmPistaPrefix} · {pistaNome}
          </p>
        ) : null}
        {error ? (
          <p className="mt-1.5 text-xs text-red-400">{error}</p>
        ) : null}
      </div>
      <div className="relative z-[1] mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-podium-muted">
          {formatRelativeShort(search.created_at)}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pending}
            title={unsaved ? COPY.salvarLista : COPY.tirarDasListas}
            onClick={() => onToggleSaved(Boolean(unsaved))}
            className={cn(
              iconActionClass,
              unsaved
                ? "border-podium-yellow/40 bg-podium-yellow text-podium-navy hover:brightness-110"
                : "border-white/15 text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow",
            )}
          >
            {unsaved ? (
              <BookmarkPlus className="h-3.5 w-3.5" />
            ) : (
              <BookmarkMinus className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">
              {unsaved ? COPY.salvarLista : COPY.tirarDasListas}
            </span>
          </button>
          {unsaved ? null : (
            <ListSearchMenu search={search} onDeleted={onDeleted} />
          )}
        </div>
      </div>
    </GlassCard>
  );
}
