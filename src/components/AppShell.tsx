"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { BrandLogo } from "@/components/BrandLogo";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { LongOpChip } from "@/components/DataPullIndicator";
import { PilotHeaderAvatar } from "@/components/PilotHeaderAvatar";
import { CatchUpRunner } from "@/components/CatchUpRunner";
import { ShellRail, useShellRailOpen } from "@/components/ShellRail";
import { COPY } from "@/lib/copy";
import { isShellNavActive, SHELL_WORK_NAV } from "@/lib/shell-nav";
import { shellRailWidthClass } from "@/lib/shell-rail";
import { cn } from "@/lib/utils";

function MobileNavItem({
  href,
  label,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: "dark" | "light";
}) {
  return (
    <Link
      href={href}
      data-tour={href === "/largada" ? "nova-lista" : undefined}
      className="group relative flex flex-1 flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px]"
    >
      <MobileNavFace href={href} label={label} icon={Icon} tone={tone} />
    </Link>
  );
}

function MobileNavFace({
  href,
  label,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: "dark" | "light";
}) {
  const pathname = usePathname();
  const { pending } = useLinkStatus();
  const active = isShellNavActive(href, pathname) || pending;
  const opening = pending && href === "/crm";

  return (
    <span
      className={cn(
        "inline-flex w-full flex-col items-center gap-1",
        active
          ? "text-podium-yellow"
          : tone === "light"
            ? "text-zinc-500"
            : "text-podium-muted",
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
  tone: "dark" | "light";
}) {
  const light = props.tone === "light";
  return (
    <Suspense
      fallback={
        <aside
          className={cn(
            "hidden h-full shrink-0 border-r md:block",
            light
              ? "border-zinc-200 bg-white"
              : "border-white/10 bg-podium-navy/90",
            shellRailWidthClass(props.open),
          )}
        />
      }
    >
      <ShellRail
        open={props.open}
        onToggle={props.onToggle}
        homeHref={props.homeHref}
        tone={props.tone}
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
  tone = "dark",
}: {
  children: React.ReactNode;
  title?: string;
  back?: { href: string; label: string };
  fill?: boolean;
  wide?: boolean;
  lockHeight?: boolean;
  tone?: "dark" | "light";
}) {
  const { open, toggle } = useShellRailOpen();
  const light = tone === "light";

  return (
    <div
      className={cn(
        "relative flex h-dvh min-w-0 flex-col overflow-hidden",
        light ? "bg-zinc-50 text-zinc-900" : "text-podium-white",
      )}
    >
      <div className="shrink-0">
        <DemoModeBanner />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <RailSlot open={open} onToggle={toggle} tone={tone} />
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            lockHeight ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          <header
            className={cn(
              "sticky top-0 z-40 shrink-0 border-b",
              light
                ? "border-zinc-200 bg-white"
                : "border-white/10 bg-podium-navy/80 backdrop-blur-xl",
            )}
          >
            <div className="flex h-12 items-center gap-3 px-3 md:px-4">
              <Link href="/painel" className="flex shrink-0 items-center md:hidden" aria-label="GRID">
                <BrandLogo
                  variant="mark"
                  className={cn(
                    "h-8 w-auto text-[2rem]",
                    light && "text-zinc-900",
                  )}
                  priority
                />
              </Link>
              {title ? (
                <p
                  className={cn(
                    "min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.14em]",
                    light ? "text-zinc-500" : "text-podium-muted",
                  )}
                >
                  {title}
                </p>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
                <LongOpChip />
                <Suspense fallback={<span className="inline-block h-8 w-14" />}>
                  <PilotHeaderAvatar tone={tone} />
                </Suspense>
              </div>
            </div>
          </header>

          <main
            className={cn(
              "mx-auto flex w-full min-h-0 min-w-0 flex-1 flex-col pb-24 md:pb-8",
              wide ? "max-w-none px-3 pt-4" : "max-w-7xl px-4 pt-5",
              lockHeight && "overflow-hidden",
              light && "bg-zinc-50 text-zinc-900",
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

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t md:hidden",
          light
            ? "border-zinc-200 bg-white"
            : "border-white/10 bg-podium-navy/95 backdrop-blur-xl",
        )}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2">
          {SHELL_WORK_NAV.map((item) => (
            <MobileNavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              tone={tone}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}
