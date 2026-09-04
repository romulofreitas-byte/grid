"use client";

import { Button } from "@/components/ui/Button";
import { Hint } from "@/components/Hint";
import {
  clearOpsDimensions,
  hasOpsDimension,
  OPS_RANGES,
  opsRangeLabel,
  type OpsDashboardFilters,
  type OpsFilterDimension,
  type OpsRange,
  withOpsRange,
} from "@/lib/ops/filters";
import { cohortLabel, planLabel } from "@/app/ops/_components/format";

function Chip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="rounded-full border border-podium-yellow/40 bg-podium-yellow/10 px-2.5 py-1 text-[11px] font-bold text-podium-yellow hover:bg-podium-yellow/20"
    >
      {label} ×
    </button>
  );
}

export function OpsFilterBar({
  filters,
  onChange,
  labels,
}: {
  filters: OpsDashboardFilters;
  onChange: (next: OpsDashboardFilters) => void;
  labels?: { niche?: string };
}) {
  const chips: { key: OpsFilterDimension; label: string }[] = [];
  if (filters.cohort) {
    chips.push({ key: "cohort", label: cohortLabel(filters.cohort) });
  }
  if (filters.plan) {
    chips.push({ key: "plan", label: planLabel(filters.plan) });
  }
  if (filters.uf) {
    chips.push({ key: "uf", label: filters.uf });
  }
  if (filters.nicheId) {
    chips.push({ key: "nicheId", label: labels?.niche ?? "Nicho" });
  }
  if (filters.recharged === true) {
    chips.push({ key: "recharged", label: "Recarregou" });
  }
  if (filters.recharged === false) {
    chips.push({ key: "recharged", label: "Sem recarga" });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {OPS_RANGES.map((range) => (
          <Button
            key={range}
            size="sm"
            variant={filters.range === range ? "accent" : "secondary"}
            onClick={() => onChange(withOpsRange(filters, range as OpsRange))}
          >
            {opsRangeLabel(range)}
          </Button>
        ))}
      </div>
      {hasOpsDimension(filters) ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              onClear={() => {
                const next = { ...filters };
                delete next[chip.key];
                onChange(next);
              }}
            />
          ))}
          <button
            type="button"
            className="text-[11px] font-bold text-podium-muted hover:text-podium-white"
            onClick={() => onChange(clearOpsDimensions(filters))}
          >
            Limpar recorte
          </button>
        </div>
      ) : (
        <Hint>
          Clique num gráfico para cruzar coorte, plano, UF, nicho ou recarga.
        </Hint>
      )}
    </div>
  );
}
