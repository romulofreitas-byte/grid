"use client";

import { COPY } from "@/lib/copy";
import { formatRelativeShort } from "@/lib/format";
import type { Search } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ListTile({
  search,
  unsaved,
  selected,
  error,
  onSelect,
}: {
  search: Search;
  unsaved?: boolean;
  selected?: boolean;
  error?: string | null;
  onSelect: () => void;
}) {
  const leads = search.total_found ?? 0;
  const leadLabel = leads === 1 ? COPY.listasLeadOne : COPY.listasLeadMany;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition",
        selected
          ? "border-podium-yellow/40 bg-podium-yellow/10"
          : unsaved
            ? "border-dashed border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"
            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
      )}
    >
      <span className="min-w-0 flex-1">
        {unsaved ? (
          <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
            {COPY.listasRascunho}
          </span>
        ) : null}
        <span
          className={cn(
            "block truncate text-[12px] font-medium",
            unsaved ? "text-podium-gray" : "text-podium-white",
          )}
        >
          {search.nome}
        </span>
        <span className="block truncate text-[11px] text-podium-muted">
          {formatRelativeShort(search.created_at)}
          {error ? <span className="text-red-400"> · {error}</span> : null}
        </span>
      </span>
      <span className="shrink-0 text-right text-[11px] tabular-nums text-podium-gray">
        {leads.toLocaleString("pt-BR")}
        <span className="ml-1 font-medium text-podium-muted">{leadLabel}</span>
      </span>
    </button>
  );
}
