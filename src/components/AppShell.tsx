"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { cn } from "@/lib/utils";

const nav = [
  { href: "/box", label: "Box", icon: LayoutGrid },
  { href: "/largada", label: "Nova lista", icon: Flag },
  { href: "/empresas", label: "Empresas", icon: Search },
  { href: "/listas", label: "Listas", icon: List },
  { href: "/crm", label: "CRM", icon: Columns3 },
];

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
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "relative text-podium-white",
        lockHeight ? "flex h-dvh flex-col overflow-hidden" : "min-h-screen",
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
            {nav.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-podium-yellow/15 text-podium-yellow"
                      : "text-podium-gray hover:text-podium-white",
                  )}
                >
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-podium-yellow" />
                  ) : null}
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
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
          lockHeight && "min-h-0 flex-1 overflow-hidden",
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
              lockHeight && "overflow-hidden",
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
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px]",
                  active ? "text-podium-yellow" : "text-podium-muted",
                )}
              >
                {active ? (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-podium-yellow" />
                ) : null}
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
