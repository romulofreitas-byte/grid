"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnchorPopover } from "@/components/AnchorPopover";
import { logoutPilot } from "@/lib/auth/logout-client";
import { pathWithSearch, planosHref } from "@/lib/billing/href";
import { displayName } from "@/lib/pilot-profile";
import {
  footerItemKey,
  isFooterAccordion,
  isShellChildActive,
  SHELL_FOOTER_NAV,
  type ShellFooterItem,
} from "@/lib/shell-nav";
import {
  readShellRailExpanded,
  writeShellRailExpanded,
} from "@/lib/shell-rail";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-podium-gray hover:bg-white/5 hover:text-podium-white";

function footerHref(item: ShellFooterItem, from: string): string | undefined {
  if (item.action === "logout") return undefined;
  return item.billingFrom ? planosHref(from) : item.href;
}

export function PilotHeaderAvatar() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [expandedKey, setExpandedKey] = useState(readShellRailExpanded);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return null;
      return (await res.json()) as Profile;
    },
  });

  async function logout() {
    if (leaving) return;
    setLeaving(true);
    await logoutPilot();
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
  const name = displayName(p);

  return (
    <>
      <div className="hidden min-w-0 flex-col items-end justify-center leading-tight md:flex">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted">
          Piloto
        </span>
        <span className="max-w-[10rem] truncate text-xs text-podium-white">{name}</span>
      </div>
      <div ref={rootRef} className="relative min-w-0 shrink-0 md:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Abrir menu"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-podium-gray outline-none transition hover:text-podium-white",
            "ring-offset-2 ring-offset-podium-navy focus-visible:ring-2 focus-visible:ring-podium-yellow",
            open && "text-podium-white",
          )}
        >
          Menu
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-podium-muted transition-transform",
              open && "rotate-180 text-podium-white",
            )}
          />
        </button>
        <AnchorPopover
          open={open}
          anchorRef={rootRef}
          panelRef={panelRef}
          align="end"
          className="w-52 overflow-hidden py-1"
        >
          <div role="menu">
            <div className="border-b border-white/10 px-3 py-2">
              <p className="truncate text-sm font-medium text-podium-white">{name}</p>
            </div>
            {SHELL_FOOTER_NAV.map((item) => {
              const key = footerItemKey(item);
              const Icon = item.icon;
              const href = footerHref(item, from);
              const expanded = expandedKey === key;

              if (item.action === "logout") {
                return (
                  <div key={key}>
                    <div className="my-1 border-t border-white/10" />
                    <button
                      type="button"
                      role="menuitem"
                      disabled={leaving}
                      onClick={() => void logout()}
                      className={cn(itemClass, "disabled:opacity-60")}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  </div>
                );
              }

              if (isFooterAccordion(item) && item.children?.length) {
                return (
                  <div key={key}>
                    <button
                      type="button"
                      role="menuitem"
                      aria-expanded={expanded}
                      onClick={() => {
                        const next = expandedKey !== key ? key : null;
                        setExpandedKey(next);
                        writeShellRailExpanded(next);
                      }}
                      className={itemClass}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                      <ChevronDown
                        className={cn(
                          "ml-auto h-3.5 w-3.5 shrink-0 text-podium-muted transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </button>
                    {expanded
                      ? item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className={cn(
                              itemClass,
                              "pl-9",
                              isShellChildActive(child, pathname, null)
                                ? "text-podium-yellow"
                                : "text-podium-muted",
                            )}
                          >
                            {child.label}
                          </Link>
                        ))
                      : null}
                  </div>
                );
              }

              if (!href) return null;

              return (
                <Link
                  key={key}
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
          </div>
        </AnchorPopover>
      </div>
    </>
  );
}
