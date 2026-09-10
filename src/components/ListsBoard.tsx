"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookmarkMinus, BookmarkPlus, ChevronLeft, Plus } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { ListPerformanceBoard } from "@/components/ListPerformanceBoard";
import { ListSearchMenu } from "@/components/ListSearchMenu";
import { ListSummaryBadges } from "@/components/ListSummaryBadges";
import { ListTile } from "@/components/ListTile";
import { Button, buttonClassName } from "@/components/ui/Button";
import { pistaNomeForSearch } from "@/lib/crm/bridge";
import { COPY } from "@/lib/copy";
import { useLgUp } from "@/hooks/useMinWidth";
import { formatRelativeShort } from "@/lib/format";
import { gridHref, largadaEditHref, largadaNovaHref } from "@/lib/back";
import type { ListPerformance } from "@/lib/listas/performance";
import { emptyListPerformance } from "@/lib/listas/performance";
import {
  applySearchSaved,
  partitionSearches,
  removeSearch,
  savedLeadsTotal,
  UNSAVED_LIST_CAP,
} from "@/lib/searches";
import type { Search } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  workSplitClass,
  workSplitPaneClass,
  workSplitRailClass,
} from "@/lib/work-split";

type ListFilter = "salvas" | "rascunhos";

export function ListsBoard({
  initial,
  pipelineNomes = [],
  performanceById = {},
}: {
  initial: Search[];
  pipelineNomes?: string[];
  performanceById?: Record<string, ListPerformance>;
}) {
  const [searches, setSearches] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<ListFilter>("salvas");
  const lgUp = useLgUp();
  const [mobileDetail, setMobileDetail] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const { saved, unsaved } = partitionSearches(initial);
    return saved[0]?.id ?? unsaved[0]?.id ?? null;
  });
  const { saved, unsaved } = useMemo(
    () => partitionSearches(searches),
    [searches],
  );
  const leadsTotal = savedLeadsTotal(saved);
  const volumeLabel = COPY.listasVolumeAria.replace(
    "{n}",
    leadsTotal.toLocaleString("pt-BR"),
  );
  const rows = filter === "salvas" ? saved : unsaved;
  const selected = useMemo(
    () => searches.find((row) => row.id === selectedId) ?? null,
    [searches, selectedId],
  );

  useEffect(() => {
    if (!lgUp) return;
    if (selectedId && searches.some((row) => row.id === selectedId)) return;
    const next =
      (filter === "salvas" ? saved : unsaved)[0] ?? saved[0] ?? unsaved[0];
    setSelectedId(next?.id ?? null);
  }, [filter, searches, selectedId, saved, unsaved, lgUp]);

  function clearError(searchId: string) {
    setErrors((current) => {
      if (!(searchId in current)) return current;
      const next = { ...current };
      delete next[searchId];
      return next;
    });
  }

  async function toggleSaved(search: Search, savedNext: boolean) {
    setPendingId(search.id);
    clearError(search.id);
    const previous = searches;
    setSearches((current) => applySearchSaved(current, search.id, savedNext));
    try {
      const res = await fetch(`/api/search/${search.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved: savedNext }),
      });
      if (!res.ok) throw new Error("Não foi possível mover");
    } catch {
      setSearches(previous);
      setErrors((current) => ({
        ...current,
        [search.id]: savedNext
          ? "Não foi possível salvar. Tente de novo."
          : "Não foi possível tirar. Tente de novo.",
      }));
    } finally {
      setPendingId((current) => (current === search.id ? null : current));
    }
  }

  function onDeleted(searchId: string) {
    setSearches((current) => removeSearch(current, searchId));
    clearError(searchId);
    if (selectedId === searchId) {
      setSelectedId(null);
      setMobileDetail(false);
    }
  }

  const emptyList =
    filter === "salvas" ? (
      <p className="px-1 py-6 text-sm text-podium-muted">
        Nenhuma lista salva ainda.{" "}
        {unsaved.length > 0 ? (
          <>
            Salve um rascunho, ou faça uma{" "}
            <Link href={largadaNovaHref} className="text-podium-yellow">
              {COPY.novaLista.toLowerCase()}
            </Link>
            .
          </>
        ) : (
          <>
            Faça uma{" "}
            <Link href={largadaNovaHref} className="text-podium-yellow">
              {COPY.novaLista.toLowerCase()}
            </Link>
            .
          </>
        )}
      </p>
    ) : (
      <p className="px-1 py-6 text-sm text-podium-muted">
        {saved.length > 0
          ? "Todas as buscas estão em Minhas listas."
          : "Nenhuma busca ainda. Comece uma "}
        {saved.length === 0 ? (
          <>
            <Link href={largadaNovaHref} className="text-podium-yellow">
              {COPY.novaLista.toLowerCase()}
            </Link>
            .
          </>
        ) : null}
      </p>
    );

  return (
    <div className={workSplitClass}>
      <div className={cn(workSplitRailClass, !lgUp && mobileDetail && "hidden")}>
        <div className="flex shrink-0 items-center gap-2">
          {leadsTotal > 0 ? (
            <button
              type="button"
              onClick={() => setFilter("salvas")}
              title={volumeLabel}
              aria-label={volumeLabel}
              className={buttonClassName({ variant: "accent", size: "sm" })}
            >
              <span className="tracking-tight">
                {leadsTotal.toLocaleString("pt-BR")}
              </span>
              <span className="uppercase tracking-[0.12em]">
                {COPY.listasVolumeLabel}
              </span>
            </button>
          ) : null}
          <Link
            href={largadaNovaHref}
            data-tour="nova-lista"
            className={buttonClassName({
              variant: "primary",
              size: "md",
              className: "ml-auto min-h-11 md:min-h-0 md:h-7 md:px-2 md:text-[11px]",
            })}
          >
            <Plus className="h-3.5 w-3.5" />
            {COPY.novaLista}
          </Link>
        </div>
        <div className="mt-2 inline-flex shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setFilter("salvas")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
              filter === "salvas"
                ? "bg-podium-yellow text-podium-navy"
                : "text-podium-muted hover:text-podium-white",
            )}
          >
            Minhas listas · {saved.length}
          </button>
          <button
            type="button"
            onClick={() => setFilter("rascunhos")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
              filter === "rascunhos"
                ? "bg-podium-yellow text-podium-navy"
                : "text-podium-muted hover:text-podium-white",
            )}
          >
            {COPY.listasNaoSalvas} · {unsaved.length}/{UNSAVED_LIST_CAP}
          </button>
        </div>
        <div id="listas-salvas" className="mt-2 min-h-0 flex-1 space-y-1">
          {rows.length === 0
            ? emptyList
            : rows.map((item) => (
                <ListTile
                  key={item.id}
                  search={item}
                  unsaved={!item.saved}
                  selected={item.id === selectedId}
                  error={errors[item.id]}
                  performance={
                    item.saved ? performanceById[item.id] : undefined
                  }
                  onSelect={() => {
                    setSelectedId(item.id);
                    if (!lgUp) setMobileDetail(true);
                  }}
                />
              ))}
        </div>
      </div>

      <div
        className={cn(
          workSplitPaneClass,
          "space-y-3",
          !lgUp && !mobileDetail && "hidden",
        )}
      >
        {!lgUp && selected ? (
          <button
            type="button"
            onClick={() => setMobileDetail(false)}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-podium-yellow"
          >
            <ChevronLeft className="h-4 w-4" />
            {COPY.listasBackToList}
          </button>
        ) : null}
        {selected ? (
          <ListDetail
            search={selected}
            pistaNome={
              selected.saved
                ? pistaNomeForSearch(selected, pipelineNomes)
                : null
            }
            performance={
              selected.saved
                ? (performanceById[selected.id] ??
                  emptyListPerformance(selected.id))
                : null
            }
            otherHasWin={saved.some(
              (row) =>
                row.id !== selected.id &&
                (performanceById[row.id]?.ganhos ?? 0) > 0,
            )}
            error={errors[selected.id]}
            pending={pendingId === selected.id}
            onToggleSaved={(next) => void toggleSaved(selected, next)}
            onDeleted={onDeleted}
          />
        ) : (
          <p className="px-1 py-6 text-sm text-podium-muted">
            {COPY.listasPickHint}{" "}
            <Link href={largadaNovaHref} className="text-podium-yellow">
              {COPY.novaLista.toLowerCase()}
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

function ListDetail({
  search,
  pistaNome,
  performance,
  otherHasWin,
  error,
  pending,
  onToggleSaved,
  onDeleted,
}: {
  search: Search;
  pistaNome?: string | null;
  performance?: ListPerformance | null;
  otherHasWin?: boolean;
  error?: string | null;
  pending?: boolean;
  onToggleSaved: (saved: boolean) => void;
  onDeleted: (searchId: string) => void;
}) {
  const unsaved = !search.saved;
  const leads = search.total_found ?? 0;
  const leadLabel = leads === 1 ? COPY.listasLeadOne : COPY.listasLeadMany;
  const href = gridHref(search.id, "listas");

  return (
    <GlassCard className="p-3" hover={false}>
      {unsaved ? (
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted">
          {COPY.listasRascunho}
        </p>
      ) : null}
      <p
        className={cn(
          "text-base font-semibold leading-snug",
          unsaved ? "mt-0.5 text-podium-gray" : "text-podium-white",
        )}
      >
        {search.nome}
      </p>
      <p className="mt-1 text-[12px] text-podium-muted">
        {leads.toLocaleString("pt-BR")} {leadLabel}
        <span> · {formatRelativeShort(search.created_at)}</span>
      </p>
      <ListSummaryBadges filters={search.filtros} className="mt-2" />
      {pistaNome ? (
        <p className="mt-1.5 truncate text-[11px] text-podium-muted">
          {COPY.crmPistaPrefix} · {pistaNome}
        </p>
      ) : null}
      {error ? <p className="mt-1.5 text-xs text-red-400">{error}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={href}
          className={buttonClassName({ variant: "primary", size: "md" })}
        >
          Abrir
        </Link>
        <Button
          type="button"
          size="sm"
          variant={unsaved ? "accent" : "secondary"}
          disabled={pending}
          onClick={() => onToggleSaved(Boolean(unsaved))}
        >
          {unsaved ? (
            <BookmarkPlus className="h-3.5 w-3.5" />
          ) : (
            <BookmarkMinus className="h-3.5 w-3.5" />
          )}
          {unsaved ? COPY.salvarLista : COPY.tirarDasListas}
        </Button>
        <Link
          href={largadaEditHref(search.id, "listas")}
          className={buttonClassName({ variant: "secondary", size: "sm" })}
        >
          {COPY.ajustar}
        </Link>
        {unsaved ? null : (
          <ListSearchMenu
            search={search}
            onDeleted={onDeleted}
            showAdjust={false}
          />
        )}
      </div>
      {unsaved ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-2.5 py-2 text-[12px] leading-snug text-podium-muted">
          {COPY.listasDraftBoard}
        </p>
      ) : performance ? (
        <ListPerformanceBoard
          searchId={search.id}
          stats={performance}
          otherHasWin={otherHasWin}
        />
      ) : null}
    </GlassCard>
  );
}
