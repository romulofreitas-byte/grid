"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { IntegrationCatalogItem } from "@/lib/integrations/catalog";

export function IntegrationLogo({
  item,
  className,
  size = "md",
  active = false,
}: {
  item: IntegrationCatalogItem;
  className?: string;
  size?: "xs" | "sm" | "md";
  active?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const box =
    size === "xs" ? "h-4 w-4" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const initialsSize = size === "xs" ? "text-[8px]" : "text-[11px]";

  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg font-extrabold text-white",
          box,
          initialsSize,
          className,
        )}
        style={{ backgroundColor: item.accent }}
        aria-hidden
      >
        {item.initials}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.06]",
        box,
        className,
      )}
    >
      <img
        src={item.logo}
        alt=""
        className={cn(
          "h-full w-full object-contain transition duration-300",
          size === "xs" ? "p-0" : "p-1",
          active
            ? "grayscale-0 opacity-100"
            : "grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 group-aria-pressed:grayscale-0 group-aria-pressed:opacity-100",
        )}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
