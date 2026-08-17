"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  segmentNameMap,
  summarizeFilters,
  type NicheTreeLike,
} from "@/lib/filter-summary";
import type { SearchFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FilterSummary({
  filters,
  compact = false,
  className,
}: {
  filters: SearchFilters;
  compact?: boolean;
  className?: string;
}) {
  const treeQuery = useQuery({
    queryKey: ["niche-tree"],
    queryFn: async () => {
      const res = await fetch("/api/niches/presets?tree=1");
      return (await res.json()) as NicheTreeLike;
    },
  });

  const names = useMemo(
    () => segmentNameMap(treeQuery.data ?? []),
    [treeQuery.data],
  );
  const chips = summarizeFilters(filters, names);
  if (chips.length === 0) return null;

  if (compact) {
    return (
      <p className={cn("text-xs text-podium-muted", className)}>
        {chips
          .slice(0, 4)
          .map((c) => c.label)
          .join(" · ")}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((c) => (
        <span
          key={c.key}
          className="rounded-lg bg-white/5 px-2 py-1 text-[11px] font-bold text-podium-gray"
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
