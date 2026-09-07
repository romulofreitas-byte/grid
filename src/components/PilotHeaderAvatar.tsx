"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnchorPopover } from "@/components/AnchorPopover";
import { useFocusMode } from "@/components/FocusModeProvider";
import { FocusSwitch } from "@/components/FocusSwitch";
import { PilotAvatar } from "@/components/PilotAvatar";
import { PilotGlassChip } from "@/components/PilotGlassChip";
import { logoutPilot } from "@/lib/auth/logout-client";
import { pathWithSearch, planosHref } from "@/lib/billing/href";
import { displayName, headerGivenName } from "@/lib/pilot-profile";
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
  const { on: focusOn, toggle: toggleFocus } = useFocusMode();
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
  const fullName = displayName(p);
  const shortName = headerGivenName(p);

  return (
    <>
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <FocusSwitch on={focusOn} onToggle={toggleFocus} />
        <PilotGlassChip
          profile={p}
          shortName={shortName}
          fullName={fullName}
        />
      </div>
      <div ref={rootRef} className="relative min-w-0 shrink-0 md:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Abrir menu · ${fullName}`}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-podium-yellow ring-offset-2 ring-offset-podium-navy"
        >
          <PilotAvatar profile={p} size="header" shape="squircle" />
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
              <p className="truncate text-sm font-medium text-podium-white">{fullName}</p>
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
