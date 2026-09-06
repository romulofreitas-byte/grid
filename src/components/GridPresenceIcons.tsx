"use client";

import { GRID_PRESENCE_MARK } from "@/lib/audit/grid-presence";
import { COPY } from "@/lib/copy";
import type { GridPresenceAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GridPresenceIcons({
  presence,
  className,
}: {
  presence: GridPresenceAsset[] | undefined;
  className?: string;
}) {
  if (!presence?.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {presence.map((asset) => {
        const mark = GRID_PRESENCE_MARK[asset.id];
        const label = asset.unverified
          ? `${mark.name} · ${COPY.fichaSealUnverified}`
          : mark.name;
        return (
          <a
            key={asset.id}
            href={asset.href}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            aria-label={label}
            className={cn(
              "inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm",
              asset.unverified
                ? "opacity-40 hover:opacity-70"
                : "opacity-90 hover:opacity-100",
            )}
          >
            <img src={mark.logo} alt="" className="h-full w-full object-contain" />
          </a>
        );
      })}
    </div>
  );
}
