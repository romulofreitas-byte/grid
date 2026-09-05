"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { pathWithSearch, planosHref } from "@/lib/billing/href";
import { Cable, LogOut, Settings, Upload, UserRound, Wallet } from "lucide-react";
import { PilotAvatar } from "@/components/PilotAvatar";
import { AnchorPopover } from "@/components/AnchorPopover";
import { CATCHUP_SESSION_KEY } from "@/lib/catchup/constants";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const menu = [
  { href: "/conta", label: "Conta", icon: UserRound },
  { href: "/conexoes", label: "Conexões", icon: Cable },
  { href: "/importacoes", label: "Importações", icon: Upload },
  { href: "/planos", label: "Planos", icon: Wallet },
  { href: "/admin/nichos", label: "Admin", icon: Settings, adminOnly: true },
] as const;

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-podium-gray hover:bg-white/5 hover:text-podium-white";

function clearLocalSession() {
  try {
    localStorage.removeItem("grid_mock_session");
    sessionStorage.removeItem(CATCHUP_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function PilotHeaderAvatar() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return null;
      return (await res.json()) as Profile & { isAdmin?: boolean };
    },
  });

  async function logout() {
    if (leaving) return;
    setLeaving(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {
      /* still leave */
    }
    clearLocalSession();
    window.location.assign("/entrar");
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
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

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = pathWithSearch(pathname, searchParams.toString());
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
      <AnchorPopover
        open={open}
        anchorRef={rootRef}
        panelRef={panelRef}
        align="end"
        className="w-48 overflow-hidden py-1"
      >
        <div role="menu">
          {menu
            .filter((item) => !("adminOnly" in item && item.adminOnly) || p.isAdmin)
            .map((item) => {
            const Icon = item.icon;
            const href =
              item.href === "/planos" ? planosHref(from) : item.href;
            return (
              <Link
                key={item.href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            role="menuitem"
            disabled={leaving}
            onClick={() => void logout()}
            className={cn(itemClass, "disabled:opacity-60")}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </AnchorPopover>
    </div>
  );
}
