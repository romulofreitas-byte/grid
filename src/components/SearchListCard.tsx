import type { ReactNode } from "react";
import { FilterSummary } from "@/components/FilterSummary";
import { OpenableCard } from "@/components/OpenableCard";
import { gridHref, type GridFrom } from "@/lib/back";
import { COPY } from "@/lib/copy";
import type { Search } from "@/lib/types";

export function SearchListCard({
  search,
  from,
  actions,
  unsaved,
  error,
  pistaNome,
}: {
  search: Search;
  from: GridFrom;
  actions: ReactNode;
  unsaved?: boolean;
  error?: string | null;
  pistaNome?: string | null;
}) {
  return (
    <OpenableCard
      href={gridHref(search.id, from)}
      label={`Abrir grid ${search.nome}`}
      actions={actions}
    >
      <p className="font-bold">{search.nome}</p>
      <p className="text-xs text-podium-muted">
        {new Date(search.created_at).toLocaleString("pt-BR")} ·{" "}
        {search.total_found ?? 0} leads
        {unsaved ? " · não salva" : ""}
        {pistaNome ? ` · ${COPY.crmPistaPrefix} · ${pistaNome}` : ""}
      </p>
      <FilterSummary filters={search.filtros} compact className="mt-1.5" />
      {error ? (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      ) : null}
    </OpenableCard>
  );
}
