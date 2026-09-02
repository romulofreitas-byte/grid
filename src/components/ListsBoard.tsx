"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { ListTile } from "@/components/ListTile";
import { SectionTitle } from "@/components/SectionTitle";
import { Button } from "@/components/ui/Button";
import { pistaNomeForSearch } from "@/lib/crm/bridge";
import { COPY } from "@/lib/copy";
import { largadaNovaHref } from "@/lib/back";
import {
  applySearchSaved,
  nextSavedVisibleCount,
  partitionSearches,
  removeSearch,
  SAVED_LISTS_PAGE_SIZE,
  UNSAVED_LIST_CAP,
} from "@/lib/searches";
import type { Search } from "@/lib/types";

export function ListsBoard({
  initial,
  pipelineNomes = [],
}: {
  initial: Search[];
  pipelineNomes?: string[];
}) {
  const reduce = useReducedMotion();
  const [searches, setSearches] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedVisible, setSavedVisible] = useState(SAVED_LISTS_PAGE_SIZE);
  const { saved, unsaved } = partitionSearches(searches);
  const shownSaved = saved.slice(0, savedVisible);
  const remainingSaved = Math.max(0, saved.length - shownSaved.length);

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
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionTitle>Minhas listas · {saved.length}</SectionTitle>
        <Hint className="mt-2 max-w-xl">
          {COPY.listasSalvasHint}
        </Hint>
        <SearchGrid
          items={shownSaved}
          empty={
            <GlassCard className="p-5 text-sm text-podium-muted">
              Nenhuma lista salva ainda.{" "}
              {unsaved.length > 0 ? (
                <>
                  Salve uma das buscas em {COPY.listasNaoSalvas.toLowerCase()},
                  ou faça uma{" "}
                </>
              ) : (
                "Faça uma "
              )}
              <Link href={largadaNovaHref} className="text-podium-yellow">
                {COPY.novaLista.toLowerCase()}
              </Link>
              .
            </GlassCard>
          }
          reduce={Boolean(reduce)}
          renderCard={(item) => (
            <ListTile
              search={item}
              from="listas"
              pistaNome={pistaNomeForSearch(item, pipelineNomes)}
              error={errors[item.id]}
              pending={pendingId === item.id}
              onToggleSaved={(next) => void toggleSaved(item, next)}
              onDeleted={onDeleted}
            />
          )}
        />
        {remainingSaved > 0 ? (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setSavedVisible((current) =>
                  nextSavedVisibleCount(current, saved.length),
                )
              }
            >
              {COPY.listasMostrarMais.replace("{n}", String(remainingSaved))}
            </Button>
          </div>
        ) : null}
      </section>

      <section>
        <SectionTitle>
          {COPY.listasNaoSalvas} · {unsaved.length} de {UNSAVED_LIST_CAP}
        </SectionTitle>
        <Hint className="mt-2 max-w-xl">
          {COPY.listasNaoSalvasHint}
        </Hint>
        <SearchGrid
          items={unsaved}
          empty={
            <GlassCard className="p-5 text-sm text-podium-muted">
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
            </GlassCard>
          }
          reduce={Boolean(reduce)}
          compact
          renderCard={(item) => (
            <ListTile
              search={item}
              from="listas"
              unsaved
              error={errors[item.id]}
              pending={pendingId === item.id}
              onToggleSaved={(next) => void toggleSaved(item, next)}
              onDeleted={onDeleted}
            />
          )}
        />
      </section>
    </div>
  );
}

function SearchGrid({
  items,
  empty,
  reduce,
  compact,
  renderCard,
}: {
  items: Search[];
  empty: ReactNode;
  reduce: boolean;
  compact?: boolean;
  renderCard: (search: Search) => ReactNode;
}) {
  if (items.length === 0) {
    return <div className="mt-6">{empty}</div>;
  }

  return (
    <div
      className={
        compact
          ? "mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          : "mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      }
    >
      {items.map((search) => (
        <motion.div
          key={search.id}
          layout={!reduce}
          layoutId={reduce ? undefined : `listas-${search.id}`}
          transition={{ duration: reduce ? 0 : 0.22 }}
        >
          {renderCard(search)}
        </motion.div>
      ))}
    </div>
  );
}
