"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { MobileMoreSheet } from "@/components/MobileMoreSheet";
import { COPY } from "@/lib/copy";
import {
  isShellMoreActive,
  isShellNavActive,
  SHELL_MOBILE_NAV,
  SHELL_MORE_TAB,
  showsOpeningNav,
} from "@/lib/shell-nav";
import { cn } from "@/lib/utils";

function TabFace({
  active,
  pending,
  opening,
  label,
  icon: Icon,
}: {
  active: boolean;
  pending?: boolean;
  opening?: boolean;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex w-full flex-col items-center gap-1",
        active ? "text-podium-yellow" : "text-podium-muted",
      )}
    >
      {active ? (
        <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-podium-yellow" />
      ) : null}
      <Icon className={cn("h-5 w-5", pending && "animate-pulse")} />
      <span className="whitespace-nowrap text-[11px]">
        {opening ? COPY.crmOpeningNav : label}
      </span>
    </span>
  );
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-1"
    >
      <MobileNavFace href={href} label={label} icon={Icon} />
    </Link>
  );
}

function MobileNavFace({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = usePathname();
  const { pending } = useLinkStatus();
  const active = isShellNavActive(href, pathname) || pending;
  const opening = pending && showsOpeningNav(href);

  return (
    <TabFace
      active={active}
      pending={pending}
      opening={opening}
      label={label}
      icon={Icon}
    />
  );
}

export function MobileTabBar({
  staticNav = false,
  moreActive: moreActiveOverride,
}: {
  staticNav?: boolean;
  moreActive?: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive =
    moreActiveOverride ?? (moreOpen || isShellMoreActive(pathname));
  const MoreIcon = SHELL_MORE_TAB.icon;

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-podium-navy/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
          {staticNav
            ? SHELL_MOBILE_NAV.map((item) => (
                <span
                  key={item.href}
                  className="relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-1"
                >
                  <TabFace active={false} label={item.label} icon={item.icon} />
                </span>
              ))
            : SHELL_MOBILE_NAV.map((item) => (
                <MobileNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
          {staticNav ? (
            <span
              data-tour="nova-lista"
              className="relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-1"
            >
              <TabFace
                active={moreActive}
                label={SHELL_MORE_TAB.label}
                icon={MoreIcon}
              />
            </span>
          ) : (
            <button
              type="button"
              data-tour="nova-lista"
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              aria-label={SHELL_MORE_TAB.label}
              onClick={() => setMoreOpen(true)}
              className="group relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-1"
            >
              <TabFace
                active={moreActive}
                label={SHELL_MORE_TAB.label}
                icon={MoreIcon}
              />
            </button>
          )}
        </div>
      </nav>
      {staticNav ? null : (
        <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      )}
    </>
  );
}
