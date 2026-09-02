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
        "group relative flex h-full min-h-[12.5rem] flex-col p-4",
        unsaved &&
          "min-h-[11rem] border-dashed border-white/15 bg-white/[0.02] hover:border-white/25",
      )}
    >
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`Abrir lista ${search.nome}`}
      />
      <div className="pointer-events-none relative z-[1] flex min-h-0 flex-1 flex-col">
        <div className="min-w-0">
          {unsaved ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
              {COPY.listasRascunho}
            </p>
          ) : null}
          <p
            className={cn(
              "truncate font-semibold leading-snug",
              unsaved ? "mt-1 text-sm text-podium-gray" : "text-podium-white",
            )}
          >
            {search.nome}
          </p>
        </div>
        <p
          className={cn(
            "mt-3 font-bold tracking-tight",
            unsaved
              ? "text-2xl text-podium-muted"
              : "text-3xl text-podium-yellow",
          )}
        >
          {leads.toLocaleString("pt-BR")}
        </p>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-podium-muted">
          {leadLabel}
        </p>
        <ListSummaryBadges filters={search.filtros} className="mt-3" />
        {pistaNome ? (
          <p className="mt-2 truncate text-[11px] text-podium-muted">
            {COPY.crmPistaPrefix} · {pistaNome}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        ) : null}
      </div>
      <div className="relative z-[1] mt-4 flex items-center justify-between gap-2">
        <p className="text-[11px] text-podium-muted">
          {formatRelativeShort(search.created_at)}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pending}
            title={unsaved ? COPY.salvarLista : COPY.tirarDasListas}
            onClick={() => onToggleSaved(Boolean(unsaved))}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl border disabled:opacity-40",
              unsaved
                ? "border-podium-yellow/40 bg-podium-yellow text-podium-navy hover:brightness-110"
                : "border-white/15 text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow",
            )}
          >
            {unsaved ? (
              <BookmarkPlus className="h-4 w-4" />
            ) : (
              <BookmarkMinus className="h-4 w-4" />
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
