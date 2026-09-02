"use client";

import { useEffect, useState } from "react";
import { StartingLights } from "@/components/StartingLights";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function CrmOpeningChip({ label = COPY.crmOpening }: { label?: string }) {
  const [litCount, setLitCount] = useState(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLitCount((n) => (n >= 5 ? 1 : n + 1));
    }, 280);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-podium-navy/80 px-2.5 py-1.5"
    >
      <StartingLights compact phase="hold" litCount={litCount} />
      <span className="text-[10px] font-medium uppercase tracking-wide text-podium-yellow md:text-[11px]">
        {label}
      </span>
    </div>
  );
}

function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-white/[0.06]", className)}
    />
  );
}

export function CrmLanesSkeleton({ lanes = 4 }: { lanes?: number }) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-2">
      {Array.from({ length: lanes }, (_, index) => (
        <section
          key={index}
          className="flex h-full min-h-0 w-[17.5rem] shrink-0 flex-col rounded-lg border border-white/[0.07] bg-podium-navy/40"
        >
          <header className="shrink-0 space-y-2 border-b border-white/[0.06] px-3 py-3">
            <Pulse className="h-2 w-8" />
            <Pulse className="h-4 w-28" />
            <Pulse className="h-2.5 w-16" />
          </header>
          <div className="min-h-0 flex-1 space-y-2 p-2">
            <Pulse className="h-16 w-full rounded-md" />
            <Pulse className="h-14 w-full rounded-md" />
            <Pulse className="h-14 w-full rounded-md opacity-60" />
          </div>
        </section>
      ))}
    </div>
  );
}

export function CrmBoardSkeleton({
  opening = false,
}: {
  opening?: boolean;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
            {COPY.crmNav}
          </p>
          {opening ? (
            <div className="mt-2">
              <CrmOpeningChip />
            </div>
          ) : (
            <Pulse className="mt-2 h-7 w-48" />
          )}
          <Pulse className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Pulse className="h-7 w-28 rounded-md" />
          <Pulse className="h-7 w-36 rounded-md" />
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
        <aside className="flex h-full w-9 shrink-0 flex-col items-center gap-3 border-r border-white/10 pt-3">
          <Pulse className="h-3 w-3 rounded-full" />
          <Pulse className="h-24 w-2 rounded-full" />
        </aside>
        <CrmLanesSkeleton />
      </div>
    </div>
  );
}
