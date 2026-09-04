"use client";

import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ChartCard({
  title,
  hint,
  badge,
  children,
  className,
  active = false,
}: {
  title: string;
  hint?: string;
  badge?: string;
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <GlassCard
      className={cn(
        "flex h-full flex-col p-4",
        active && "border-podium-yellow/35",
        className,
      )}
      hover={false}
      highlight={active}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold">{title}</p>
        {badge ? (
          <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-podium-muted">
            {badge}
          </span>
        ) : null}
      </div>
      {hint ? <Hint className="mt-1">{hint}</Hint> : null}
      <div className="mt-3 flex-1">{children}</div>
    </GlassCard>
  );
}

export function ChartEmpty({ children }: { children?: ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-podium-muted">
      {children ?? "Nada neste recorte."}
    </p>
  );
}

export const OpsChartCard = ChartCard;
export const OpsEmpty = ChartEmpty;
