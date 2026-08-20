"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Cable, Settings, UserRound, Wallet } from "lucide-react";
import { PilotAvatar } from "@/components/PilotAvatar";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const menu = [
  { href: "/conta", label: "Conta", icon: UserRound },
  { href: "/conexoes", label: "Conexões", icon: Cable },
  { href: "/planos", label: "Planos", icon: Wallet },
  { href: "/admin/nichos", label: "Admin", icon: Settings, adminOnly: true },
] as const;

export function PilotHeaderAvatar() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return null;
      return (await res.json()) as Profile & { isAdmin?: boolean };
    },
  });

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const p = query.data;
  if (!p) return null;
  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full outline-none ring-offset-2 ring-offset-podium-navy focus-visible:ring-2 focus-visible:ring-podium-yellow"
        title="Conta"
      >
        <PilotAvatar profile={p} size="sm" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-podium-navy py-1"
        >
          {menu
            .filter((item) => !("adminOnly" in item && item.adminOnly) || p.isAdmin)
            .map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm text-podium-gray hover:bg-white/5 hover:text-podium-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
