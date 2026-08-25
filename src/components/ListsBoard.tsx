"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BookmarkMinus, BookmarkPlus } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { ListSearchMenu } from "@/components/ListSearchMenu";
import { SearchListCard } from "@/components/SearchListCard";
import { SectionTitle } from "@/components/SectionTitle";
import { pistaNomeForSearch } from "@/lib/crm/bridge";
import { COPY } from "@/lib/copy";
import { gridHref, largadaNovaHref } from "@/lib/back";
import {
  partitionSearches,
  removeSearch,
  setSearchSaved,
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
  const { saved, unsaved } = partitionSearches(searches);

  function clearError(searchId: string) {
    setErrors((current) => {
      if (!(searchId in current)) return current;
      const next = { ...current };
      delete next[searchId];
      return next;
    });
  }

  async function toggleSaved(search: Search, saved: boolean) {
    setPendingId(search.id);
    clearError(search.id);
    setSearches((current) => setSearchSaved(current, search.id, saved));
    try {
      const res = await fetch(`/api/search/${search.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved }),
      });
      if (!res.ok) throw new Error("Não foi possível mover");
    } catch {
      setSearches((current) => setSearchSaved(current, search.id, !saved));
      setErrors((current) => ({
        ...current,
        [search.id]: saved
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
        <Hint className="mt-2 max-w-xl text-sm">
          Listas para ligar de novo. Salvar ou tirar não apaga o grid — só
          decide se ela aparece aqui. Ajustar nicho e qualidade gera um grid
          novo; a lista original não some.
        </Hint>
        <SearchLane
          items={saved}
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
          renderCard={(search) => (
            <SearchListCard
              search={search}
              from="listas"
              pistaNome={pistaNomeForSearch(search, pipelineNomes)}
              error={errors[search.id]}
              actions={
                <>
                  <Link
                    href={gridHref(search.id, "listas")}
                    className="rounded-xl bg-podium-yellow px-3 py-2 text-xs font-bold text-podium-navy"
                  >
                    Abrir grid
                  </Link>
                  <button
                    type="button"
                    disabled={pendingId === search.id}
                    onClick={() => void toggleSaved(search, false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow disabled:opacity-40"
                  >
                    <BookmarkMinus className="h-3.5 w-3.5" />
                    {pendingId === search.id
                      ? "Movendo…"
                      : COPY.tirarDasListas}
                  </button>
                  <ListSearchMenu search={search} onDeleted={onDeleted} />
                </>
              }
            />
          )}
        />
      </section>

      <section>
        <SectionTitle>
          {COPY.listasNaoSalvas} · {unsaved.length}
        </SectionTitle>
        <Hint className="mt-2 max-w-xl text-sm">
          Buscas recentes que ainda não estão em Minhas listas. Salvar não
          apaga o grid; tirar devolve para cá.
        </Hint>
        <SearchLane
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
          renderCard={(search) => (
            <SearchListCard
              search={search}
              from="listas"
              unsaved
              error={errors[search.id]}
              actions={
                <>
                  <button
                    type="button"
                    disabled={pendingId === search.id}
                    onClick={() => void toggleSaved(search, true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-podium-yellow px-3 py-2 text-xs font-extrabold text-podium-navy hover:brightness-110 disabled:opacity-40"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    {pendingId === search.id ? "Movendo…" : COPY.salvarLista}
                  </button>
                  <Link
                    href={gridHref(search.id, "listas")}
                    className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
                  >
                    Abrir grid
                  </Link>
                  <ListSearchMenu search={search} onDeleted={onDeleted} />
                </>
              }
            />
          )}
        />
      </section>
    </div>
  );
}

function SearchLane({
  items,
  empty,
  reduce,
  renderCard,
}: {
  items: Search[];
  empty: ReactNode;
  reduce: boolean;
  renderCard: (search: Search) => ReactNode;
}) {
  return (
    <div className="mt-6 space-y-3">
      {items.length === 0 ? empty : null}
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
