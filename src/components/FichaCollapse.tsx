"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FichaCollapse({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-md border border-white/[0.08] bg-white/[0.05]",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-podium-muted hover:text-podium-gray"
      >
        <span className="text-xs font-medium text-podium-white">{title}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="border-t border-white/[0.08] p-3">{children}</div>
      ) : null}
    </div>
  );
}
