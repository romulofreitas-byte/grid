"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import {
  listSummaryBadges,
  segmentNameMap,
  type NicheTreeLike,
} from "@/lib/filter-summary";
import type { SearchFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

const BADGE_VARIANT = {
  nicho: "accent",
  local: "neutral",
  matriz: "neutral",
  "sem-contabil": "success",
} as const;

export function ListSummaryBadges({
  filters,
  municipioNames,
  className,
  sticky = false,
  includeSemContabil = false,
}: {
  filters: SearchFilters;
  municipioNames?: Record<number, string>;
  className?: string;
  sticky?: boolean;
  /** Show “Sem contábil” only on Qualidade (step 3). */
  includeSemContabil?: boolean;
}) {
  const treeQuery = useQuery({
    queryKey: ["niche-tree"],
    queryFn: async () => {
      const res = await fetch("/api/niches/presets?tree=1");
      if (!res.ok) throw new Error("niches");
      return (await res.json()) as NicheTreeLike;
    },
  });

  const segmentNames = useMemo(
    () => segmentNameMap(treeQuery.data ?? []),
    [treeQuery.data],
  );

  const badges = listSummaryBadges(filters, {
    segmentNames,
    municipioNames,
    includeSemContabil,
  });

  if (badges.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5",
        sticky &&
          "sticky top-0 z-10 -mx-1 border-b border-white/10 bg-podium-navy/95 px-1 py-2 backdrop-blur-sm",
        className,
      )}
    >
      {badges.map((b) => (
        <Badge key={b.key} variant={BADGE_VARIANT[b.key]} title={b.label}>
          {b.label}
        </Badge>
      ))}
    </div>
  );
}
