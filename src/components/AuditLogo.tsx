"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function AuditLogo({
  logo,
  initials,
  accent,
  className,
  size = "md",
  lit = false,
}: {
  logo: string;
  initials: string;
  accent: string;
  className?: string;
  size?: "sm" | "md";
  lit?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold text-white",
          box,
          className,
        )}
        style={{ backgroundColor: accent }}
        aria-hidden
      >
        {initials}
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
        src={logo}
        alt=""
        className={cn(
          "h-full w-full object-contain p-1 transition duration-300",
          lit
            ? "grayscale-0 opacity-100"
            : "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-aria-pressed:grayscale-0 group-aria-pressed:opacity-100",
        )}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
