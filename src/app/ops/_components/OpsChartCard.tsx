"use client";

import { GlassCard } from "@/components/GlassCard";
import { Hint } from "@/components/Hint";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function OpsChartCard({
  title,
  hint,
  children,
  className,
  active = false,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <GlassCard
      className={cn("p-4", active && "border-podium-yellow/35", className)}
      hover={false}
      highlight={active}
    >
      <p className="text-sm font-bold">{title}</p>
      {hint ? <Hint className="mt-1">{hint}</Hint> : null}
      <div className="mt-3">{children}</div>
    </GlassCard>
  );
}

export function OpsEmpty({ children }: { children?: ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-podium-muted">
      {children ?? "Nada neste recorte."}
    </p>
  );
}
