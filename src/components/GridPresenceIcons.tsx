"use client";

import { GRID_PRESENCE_IDS, GRID_PRESENCE_MARK } from "@/lib/audit/grid-presence";
import { COPY } from "@/lib/copy";
import type { GridPresenceAsset, GridPresenceId } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GridPresenceIcons({
  presence,
  className,
  showMissing = false,
  ids,
  iconClassName = "h-4 w-4",
}: {
  presence: GridPresenceAsset[] | undefined;
  className?: string;
  showMissing?: boolean;
  ids?: readonly GridPresenceId[];
  iconClassName?: string;
}) {
  const found = new Map((presence ?? []).map((asset) => [asset.id, asset]));
  const list = showMissing
    ? [...(ids ?? GRID_PRESENCE_IDS)]
    : [...(ids ?? GRID_PRESENCE_IDS)].filter((id) => found.has(id));

  if (!list.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {list.map((id) => {
        const mark = GRID_PRESENCE_MARK[id];
        const asset = found.get(id);
        const missing = !asset;
        const label = missing
          ? `${mark.name} · falta`
          : asset.unverified
            ? `${mark.name} · ${COPY.fichaSealUnverified}`
            : mark.name;
        const classNames = cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm",
          iconClassName,
          missing
            ? "opacity-25 grayscale"
            : asset.unverified
              ? "opacity-40 hover:opacity-70"
              : "opacity-90 hover:opacity-100",
        );
        if (missing || !asset.href) {
          return (
            <span key={id} title={label} aria-label={label} className={classNames}>
              <img src={mark.logo} alt="" className="h-full w-full object-contain" />
            </span>
          );
        }
        return (
          <a
            key={id}
            href={asset.href}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            aria-label={label}
            className={classNames}
          >
            <img src={mark.logo} alt="" className="h-full w-full object-contain" />
          </a>
        );
      })}
    </div>
  );
}
