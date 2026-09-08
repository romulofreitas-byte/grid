"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useReducedMotion } from "framer-motion";
import { BackLink } from "@/components/BackLink";
import { BrandLogo } from "@/components/BrandLogo";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { LongOpChip } from "@/components/DataPullIndicator";
import { PilotHeaderAvatar } from "@/components/PilotHeaderAvatar";
import { CatchUpRunner } from "@/components/CatchUpRunner";
import { MobileTabBar } from "@/components/MobileTabBar";
import { useBillingMe } from "@/hooks/useBillingMe";
import { useFocusMode } from "@/components/FocusModeProvider";
import {
  ShellRail,
  ShellRailOpenProvider,
  useShellRailOpen,
} from "@/components/ShellRail";
import { shellRailWidthClass } from "@/lib/shell-rail";
import { cn } from "@/lib/utils";

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

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  back?: { href: string; label: string };
  fill?: boolean;
  wide?: boolean;
  lockHeight?: boolean;
};

function BillingPrefetch() {
  useBillingMe();
  return null;
}

export function AppShell(props: AppShellProps) {
  return (
    <ShellRailOpenProvider>
      <BillingPrefetch />
      <AppShellFrame {...props} />
    </ShellRailOpenProvider>
  );
}

const TAB_PAD =
  "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-16";
const TAB_PAD_LOCK =
  "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-8";

function AppShellFrame({
  children,
  title,
  back,
  fill = false,
  wide = false,
  lockHeight = false,
}: AppShellProps) {
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
            <div className="flex h-12 items-center gap-2 px-3 md:h-14 md:gap-3 md:px-4">
              <Link
                href="/painel"
                className="flex shrink-0 items-center md:hidden"
                aria-label="GRID"
              >
                <BrandLogo
                  variant="mark"
                  className="h-7 w-auto text-[1.75rem]"
                  priority
                />
              </Link>
              {title ? (
                <p className="min-w-0 truncate text-sm font-medium text-podium-white md:text-[11px] md:font-medium md:uppercase md:tracking-[0.14em] md:text-podium-muted">
                  {title}
                </p>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
                <LongOpChip />
                <Suspense fallback={<span className="inline-block h-8 w-8 md:h-11 md:w-56" />}>
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
                    focusOn ? "pb-6" : TAB_PAD_LOCK,
                  )
                : cn("grow", focusOn ? "pb-6" : TAB_PAD),
              wide ? "max-w-none px-3 pt-3 md:pt-4" : "max-w-7xl px-4 pt-4 md:pt-5",
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
                  lockHeight && "h-0 min-w-0 overflow-hidden",
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
      <MobileTabBar />
    </div>
  );
}
