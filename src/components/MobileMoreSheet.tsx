"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId } from "react";
import { X } from "lucide-react";
import {
  isShellNavActive,
  SHELL_MORE_NAV,
} from "@/lib/shell-nav";
import { cn } from "@/lib/utils";

export function MobileMoreSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:hidden">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full overflow-hidden rounded-t-2xl border border-white/15 bg-podium-navy/95 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <p
            id={titleId}
            className="text-sm font-medium text-podium-white"
          >
            Mais
          </p>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-podium-muted hover:bg-white/5 hover:text-podium-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="grid grid-cols-2 gap-2 px-4 pb-4 pt-1">
          {SHELL_MORE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isShellNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.tour}
                onClick={onClose}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium",
                  active
                    ? "border-podium-yellow/40 bg-podium-yellow/10 text-podium-yellow"
                    : "border-white/10 bg-white/[0.03] text-podium-gray hover:border-white/20 hover:text-podium-white",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
