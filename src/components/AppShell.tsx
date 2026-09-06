"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { BackLink } from "@/components/BackLink";
import { BrandLogo } from "@/components/BrandLogo";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { LongOpChip } from "@/components/DataPullIndicator";
import { PilotHeaderAvatar } from "@/components/PilotHeaderAvatar";
import { CatchUpRunner } from "@/components/CatchUpRunner";
import { useFocusMode } from "@/components/FocusModeProvider";
import { ShellRail, useShellRailOpen } from "@/components/ShellRail";
import { COPY } from "@/lib/copy";
import { isShellNavActive, showsOpeningNav, SHELL_WORK_NAV } from "@/lib/shell-nav";
import { shellRailWidthClass } from "@/lib/shell-rail";
import { cn } from "@/lib/utils";

function MobileNavItem({
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
      data-tour={href === "/largada" ? "nova-lista" : undefined}
      className="group relative flex flex-1 flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px]"
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
    <span
      className={cn(
        "inline-flex w-full flex-col items-center gap-1",
        active ? "text-podium-yellow" : "text-podium-muted",
      )}
    >
      {active ? (
        <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-podium-yellow" />
      ) : null}
      <Icon className={cn("h-5 w-5", pending && "animate-pulse")} />
      <span className="whitespace-nowrap">
        {opening ? COPY.crmOpeningNav : label}
      </span>
    </span>
  );
}

function RailSlot(props: {
  open: boolean;
  onToggle: () => void;
  homeHref?: string;
}) {
  return (
    <Suspense
      fallback={
        <aside
          className={cn(
            "hidden h-full shrink-0 border-r border-white/10 bg-podium-navy/90 md:block",
            shellRailWidthClass(props.open),
          )}
        />
      }
    >
      <ShellRail
        open={props.open}
        onToggle={props.onToggle}
        homeHref={props.homeHref}
      />
    </Suspense>
  );
}

export function AppShell({
  children,
  title,
  back,
  fill = false,
  wide = false,
  lockHeight = false,
}: {
  children: React.ReactNode;
  title?: string;
  back?: { href: string; label: string };
  fill?: boolean;
  wide?: boolean;
  lockHeight?: boolean;
}) {
  const { open, toggle } = useShellRailOpen();
  const { on: focusOn } = useFocusMode();
  const reduce = useReducedMotion();
  const chromeSlide = reduce ? "duration-0" : "duration-300 ease-out";

  return (
    <div className="relative flex h-dvh min-w-0 flex-col overflow-hidden text-podium-white">
      <div
        className={cn(
          "grid shrink-0 transition-[grid-template-rows]",
          chromeSlide,
          focusOn ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
        )}
        aria-hidden={focusOn || undefined}
        inert={focusOn || undefined}
      >
        <div className="overflow-hidden">
          <DemoModeBanner />
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <RailSlot open={open} onToggle={toggle} />
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            lockHeight ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          <header
            className={cn(
              "sticky top-0 z-40 shrink-0 overflow-hidden border-b bg-podium-navy/80 backdrop-blur-xl",
              "transition-[max-height,opacity,border-color]",
              chromeSlide,
              focusOn
                ? "max-h-0 border-transparent opacity-0"
                : "max-h-14 border-white/10 opacity-100",
            )}
            aria-hidden={focusOn || undefined}
            inert={focusOn || undefined}
          >
            <div className="flex h-14 items-center gap-3 px-3 md:px-4">
              <Link href="/painel" className="flex shrink-0 items-center md:hidden" aria-label="GRID">
                <BrandLogo
                  variant="mark"
                  className="h-8 w-auto text-[2rem]"
                  priority
                />
              </Link>
              {title ? (
                <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-podium-muted">
                  {title}
                </p>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
                <LongOpChip />
                <Suspense fallback={<span className="inline-block h-11 w-56" />}>
                  <PilotHeaderAvatar />
                </Suspense>
              </div>
            </div>
          </header>

          <main
            className={cn(
              "mx-auto flex w-full min-w-0 flex-col transition-[padding]",
              chromeSlide,
              lockHeight
                ? cn(
                    "min-h-0 flex-1 overflow-hidden",
                    focusOn ? "pb-6" : "pb-24 md:pb-8",
                  )
                : cn("grow", focusOn ? "pb-6" : "pb-24 md:pb-16"),
              wide ? "max-w-none px-3 pt-4" : "max-w-7xl px-4 pt-5",
            )}
          >
            {back ? (
              <div className="mb-3 shrink-0">
                <BackLink href={back.href}>{back.label}</BackLink>
              </div>
            ) : null}
            {fill ? (
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col",
                  lockHeight && "min-w-0 overflow-hidden",
                  !lockHeight && "min-h-full",
                )}
              >
                {children}
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>

      <CatchUpRunner />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-podium-navy/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2">
          {SHELL_WORK_NAV.map((item) => (
            <MobileNavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}
