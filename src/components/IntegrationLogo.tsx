"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { IntegrationCatalogItem } from "@/lib/integrations/catalog";

export type IntegrationLogoSource = Pick<
  IntegrationCatalogItem,
  "logo" | "accent" | "initials"
>;

const BOX = {
  xs: "h-4 w-4",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  hub: "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]",
} as const;

export function IntegrationLogo({
  item,
  className,
  size = "md",
  active = false,
}: {
  item: IntegrationLogoSource;
  className?: string;
  size?: keyof typeof BOX;
  active?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const box = BOX[size];
  const initialsSize =
    size === "xs" ? "text-[8px]" : size === "hub" || size === "lg" ? "text-sm" : "text-[11px]";
  const colored = active || size === "hub" || size === "lg";

  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-xl font-extrabold text-white",
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
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white",
        box,
        className,
      )}
    >
      <img
        src={item.logo}
        alt=""
        className={cn(
          "h-full w-full object-contain transition duration-300",
          size === "xs" ? "p-0" : size === "hub" ? "p-2.5" : "p-1",
          colored
            ? "grayscale-0 opacity-100"
            : "grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 group-aria-pressed:grayscale-0 group-aria-pressed:opacity-100",
        )}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
