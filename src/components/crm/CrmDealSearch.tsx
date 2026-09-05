"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import { CRM_FIELD } from "@/lib/crm/client";
import {
  DEAL_SEARCH_DEBOUNCE_MS,
  canSearchDeals,
  mergeDealSearchHits,
  searchHitsFromDeals,
} from "@/lib/crm/deal-search";
import type { CrmDealCard, CrmDealSearchHit, CrmStage } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

const FIELD_WIDTH = 200;
const EASE = [0.16, 1, 0.3, 1] as const;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function outcomeLabel(hit: CrmDealSearchHit): string | null {
  if (hit.outcome === "won") return COPY.crmOutcomeWon;
  if (hit.outcome === "lost") return COPY.crmOutcomeLost;
  return null;
}

export function CrmDealSearch({
  pipelineId,
  localDeals,
  localStages,
  localPipelineNome,
  onPick,
}: {
  pipelineId: string | null;
  localDeals: CrmDealCard[];
  localStages: CrmStage[];
  localPipelineNome: string;
  onPick: (hit: CrmDealSearchHit) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebounced(query, DEAL_SEARCH_DEBOUNCE_MS);
  const typed = query.trim();
  const settled = typed === debounced.trim();
  const searching = open && canSearchDeals(typed);
  const enabled = open && canSearchDeals(debounced.trim());
  const stageNomeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const stage of localStages) map.set(stage.id, stage.nome);
    return map;
  }, [localStages]);
  const localHits = useMemo(() => {
    if (!searching) return [];
    return searchHitsFromDeals(localDeals, typed, {
      preferredPipelineId: pipelineId,
      pipelineNome: () => localPipelineNome,
      stageNome: (stageId) => stageNomeById.get(stageId) ?? "",
    });
  }, [
    searching,
    localDeals,
    typed,
    pipelineId,
    localPipelineNome,
    stageNomeById,
  ]);
  const search = useQuery({
    queryKey: ["crm-deal-search", debounced.trim(), pipelineId],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q: debounced.trim() });
      if (pipelineId) params.set("pipeline", pipelineId);
      const res = await fetch(`/api/crm/deals/search?${params}`, { signal });
      if (!res.ok) throw new Error("Não foi possível buscar.");
      return (await res.json()) as { hits: CrmDealSearchHit[] };
    },
    enabled,
    staleTime: 20_000,
  });
  const remoteReady =
    searching && settled && !search.isFetching && (search.isError || search.isFetched);
  const hits = mergeDealSearchHits(
    localHits,
    remoteReady && !search.isError ? search.data?.hits : undefined,
  );
  const pending = searching && localHits.length === 0 && (!settled || search.isFetching);
  const showList = searching && (localHits.length > 0 || remoteReady);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [typed, hits.length]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (query.trim()) {
        setQuery("");
        return;
      }
      close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, query]);

  function close() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function pick(hit: CrmDealSearchHit) {
    close();
    onPick(hit);
  }

  function toggle() {
    if (open && !query.trim()) {
      close();
      return;
    }
    setOpen(true);
  }

  const duration = reduce ? 0.01 : 0.22;

  return (
    <div
      ref={wrapRef}
      className="relative flex items-center"
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (wrapRef.current?.contains(next)) return;
        window.setTimeout(() => {
          if (!wrapRef.current?.contains(document.activeElement)) close();
        }, 0);
      }}
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="w-7 px-0"
        aria-label={COPY.crmSearchDealsAria}
        aria-expanded={open}
        title={COPY.crmSearchDeals}
        onClick={toggle}
      >
        <Search className="h-3.5 w-3.5" />
      </Button>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="crm-deal-search-field"
            initial={reduce ? false : { width: 0, opacity: 0 }}
            animate={{ width: FIELD_WIDTH, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={{ duration, ease: EASE }}
            className="relative ml-1 h-7 overflow-hidden"
          >
            <input
              ref={inputRef}
              className={cn(CRM_FIELD, "h-7 w-[200px] py-1 pr-7")}
              value={query}
              placeholder={COPY.crmSearchDealsPlaceholder}
              autoComplete="off"
              spellCheck={false}
              aria-busy={pending}
              aria-autocomplete="list"
              aria-controls={showList ? listId : undefined}
              aria-activedescendant={
                showList && hits[activeIndex]
                  ? `${listId}-${hits[activeIndex]!.dealId}`
                  : undefined
              }
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (hits.length === 0) return;
                  setActiveIndex((current) => (current + 1) % hits.length);
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (hits.length === 0) return;
                  setActiveIndex(
                    (current) => (current - 1 + hits.length) % hits.length,
                  );
                }
                if (event.key === "Enter") {
                  const hit = hits[activeIndex] ?? hits[0];
                  if (!hit) return;
                  event.preventDefault();
                  pick(hit);
                }
                if (event.key === "Escape") {
                  event.stopPropagation();
                  if (query.trim()) {
                    setQuery("");
                    return;
                  }
                  close();
                }
              }}
            />
            {pending ? (
              <span
                role="status"
                aria-label={COPY.crmSearchDealsSearching}
                className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/15 border-t-podium-yellow/80 animate-spin"
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {open && showList ? (
          <motion.div
            key="crm-deal-search-list"
            id={listId}
            role="listbox"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0.01 : 0.16, ease: EASE }}
            className="absolute right-0 top-full z-20 mt-1 max-h-56 w-72 overflow-y-auto rounded-md border border-white/10 bg-podium-panel shadow-xl"
          >
            {search.isError && localHits.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-podium-muted">
                {COPY.crmSearchDealsError}
              </p>
            ) : hits.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-podium-muted">
                {COPY.crmSearchDealsEmpty}
              </p>
            ) : (
              hits.map((hit, index) => {
                const closed = outcomeLabel(hit);
                return (
                  <button
                    key={hit.dealId}
                    id={`${listId}-${hit.dealId}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cn(
                      "block w-full px-2.5 py-2 text-left hover:bg-white/[0.04]",
                      index === activeIndex && "bg-white/[0.06]",
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(hit)}
                  >
                    <p className="truncate text-xs font-semibold text-podium-white">
                      {hit.company_name}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-podium-muted">
                      {hit.pipelineNome}
                      {hit.stageNome ? ` · ${hit.stageNome}` : ""}
                      {closed ? ` · ${closed}` : ""}
                    </p>
                  </button>
                );
              })
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
