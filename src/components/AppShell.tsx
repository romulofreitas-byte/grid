"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Columns3,
  Flag,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";
import { AngularBackground } from "@/components/AngularBackground";
import { BackLink } from "@/components/BackLink";
import { BrandLogo } from "@/components/BrandLogo";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { LongOpChip } from "@/components/DataPullIndicator";
import { PilotHeaderAvatar } from "@/components/PilotHeaderAvatar";
import { CatchUpRunner } from "@/components/CatchUpRunner";
import { SupportDock } from "@/components/SupportDock";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/box", label: "Box", icon: LayoutGrid },
  { href: "/largada", label: "Nova lista", icon: Flag },
  { href: "/empresas", label: "Empresas", icon: Search },
  { href: "/listas", label: "Listas", icon: List },
  { href: "/crm", label: "CRM", icon: Columns3 },
];

function ShellNavItem({
  href,
  label,
  icon: Icon,
  mobile = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        mobile
          ? "group relative flex flex-1 flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px]"
          : "group relative inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition"
      }
    >
      <ShellNavFace href={href} label={label} icon={Icon} mobile={mobile} />
    </Link>
  );
}

function ShellNavFace({
  href,
  label,
  icon: Icon,
  mobile,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile: boolean;
}) {
  const pathname = usePathname();
  const { pending } = useLinkStatus();
  const active = pathname.startsWith(href) || pending;
  const opening = pending && href === "/crm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        mobile && "w-full flex-col gap-1",
        active
          ? "text-podium-yellow"
          : mobile
            ? "text-podium-muted"
            : "text-podium-gray group-hover:text-podium-white",
      )}
    >
      {active ? (
        <span
          className={cn(
            "absolute rounded-full bg-podium-yellow",
            mobile ? "inset-x-4 top-0 h-0.5" : "inset-x-3 -bottom-px h-0.5",
          )}
        />
      ) : null}
      {!mobile && active ? (
        <span className="absolute inset-0 -z-10 rounded-md bg-podium-yellow/15" />
      ) : null}
      <Icon
        className={cn(mobile ? "h-5 w-5" : "h-4 w-4", pending && "animate-pulse")}
      />
      {opening ? COPY.crmOpeningNav : label}
    </span>
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
  return (
    <div
      className={cn(
        "relative text-podium-white",
        lockHeight ? "flex h-dvh min-w-0 flex-col overflow-hidden" : "min-h-screen",
      )}
    >
      <AngularBackground />
      <div className="shrink-0">
        <DemoModeBanner />
      </div>
      <header className="sticky top-0 z-40 shrink-0 border-b border-white/10 bg-podium-navy/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/box" className="flex shrink-0 items-center">
            <BrandLogo
              variant="mark"
              className="h-8 w-auto text-[2rem] md:hidden"
              priority
            />
            <BrandLogo
              variant="solo"
              className="hidden h-7 w-auto text-[1.75rem] md:inline-flex"
              priority
            />
          </Link>
          <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            {nav.map((item) => (
              <ShellNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none">
            <LongOpChip />
            {title ? (
              <p className="truncate text-sm font-medium text-podium-gray md:hidden">
                {title}
              </p>
            ) : null}
            <PilotHeaderAvatar />
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex flex-col pb-24 md:pb-10",
          wide ? "max-w-none px-3 pt-4" : "max-w-7xl px-4 pt-6",
          fill && !lockHeight && "min-h-[calc(100dvh-3.5rem)]",
          lockHeight && "min-h-0 min-w-0 w-full flex-1 overflow-hidden",
        )}
      >
        {back ? (
          <div className="mb-4 shrink-0">
            <BackLink href={back.href}>{back.label}</BackLink>
          </div>
        ) : null}
        {fill ? (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              lockHeight && "min-w-0 overflow-hidden",
            )}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </main>

      <SupportDock />
      <CatchUpRunner />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-podium-navy/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2">
          {nav.map((item) => (
            <ShellNavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              mobile
            />
          ))}
        </div>
      </nav>
    </div>
  );
}
