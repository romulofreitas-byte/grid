"use client";

import type { ReactNode } from "react";
import { AngularBackground } from "@/components/AngularBackground";
import { BrandLogo } from "@/components/BrandLogo";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function SetupStage({
  step,
  total,
  children,
  footer,
  center = false,
}: {
  step: number;
  total: number;
  children: ReactNode;
  footer: ReactNode;
  center?: boolean;
}) {
  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden text-podium-white">
      <AngularBackground />
      <header className="flex shrink-0 items-center justify-between gap-4 px-5 pt-4 md:px-12 md:pt-6">
        <BrandLogo variant="solo" className="h-8 text-[2rem] md:h-11 md:text-[2.75rem]" />
        <p className="text-[11px] font-semibold tabular-nums tracking-[0.14em] text-podium-muted">
          {step}/{total}
        </p>
      </header>
      <div className="mt-3 flex shrink-0 gap-1.5 px-5 md:mt-4 md:px-12">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={
              index < step
                ? "h-1 flex-1 rounded-full bg-podium-yellow"
                : "h-1 flex-1 rounded-full bg-white/10"
            }
            aria-hidden
          />
        ))}
      </div>
      <span className="sr-only">
        {COPY.setupProgress.replace("{n}", String(step)).replace("{total}", String(total))}
      </span>
      <main
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-y-auto px-5 py-4 md:max-w-6xl md:overflow-hidden md:px-12 md:py-6",
          center && "justify-center",
        )}
      >
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-5xl shrink-0 flex-wrap items-center justify-end gap-3 px-5 pb-4 pt-2 md:max-w-6xl md:px-12 md:pb-8">
        {footer}
      </footer>
    </div>
  );
}
