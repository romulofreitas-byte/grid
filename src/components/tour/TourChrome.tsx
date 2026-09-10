"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { AngularBackground } from "@/components/AngularBackground";
import { BrandLogo } from "@/components/BrandLogo";
import { ShellRail, useShellRailOpen } from "@/components/ShellRail";
import { MobileTabBar } from "@/components/MobileTabBar";
import { COPY } from "@/lib/copy";
import { SHELL_TAB_PAD_LOCK, SHELL_Z } from "@/lib/shell-chrome";
import { shellRailWidthClass } from "@/lib/shell-rail";
import type { Profile } from "@/lib/types";
import type { TourScene } from "@/lib/tour";
import { cn } from "@/lib/utils";

export function TourChrome({
  scene,
  children,
}: {
  scene: TourScene;
  children: React.ReactNode;
}) {
  const { open, toggle } = useShellRailOpen();
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return null;
      return (await res.json()) as Profile;
    },
    retry: false,
  });
  const signedIn = Boolean(profileQuery.data?.id);
  const home = signedIn ? "/painel" : "/";
  const ctaHref = signedIn ? "/painel" : "/entrar?modo=cadastro";
  const ctaLabel = signedIn ? COPY.landingSignedInCta : COPY.landingCtaStart;
  const activeId = scene === "painel" ? "painel" : null;

  return (
    <div className="relative flex h-dvh min-w-0 flex-col overflow-hidden text-podium-white">
      <AngularBackground />
      <div className="flex min-h-0 min-w-0 flex-1">
        <Suspense
          fallback={
            <aside
              className={cn(
                "hidden h-full shrink-0 border-r border-white/10 bg-podium-navy/90 md:block",
                shellRailWidthClass(open),
              )}
            />
          }
        >
          <ShellRail
            open={open}
            onToggle={toggle}
            itemKind="static"
            activeId={activeId}
            homeHref={home}
          />
        </Suspense>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <header
            className={cn(
              "sticky top-0 shrink-0 border-b border-white/10 bg-podium-navy/80 backdrop-blur-xl",
              SHELL_Z.header,
            )}
          >
            <div className="flex h-12 items-center gap-3 px-3 md:px-4">
              <Link
                href={home}
                className="flex shrink-0 items-center md:hidden"
                aria-label="GRID"
              >
                <BrandLogo variant="mark" className="h-8 w-auto text-[2rem]" />
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <Link
                  href={ctaHref}
                  className="rounded-md bg-podium-yellow px-3 py-1.5 text-xs font-semibold text-podium-navy transition hover:brightness-110"
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          </header>
          <main
            className={cn(
              "mx-auto w-full max-w-7xl flex-1 px-4 pt-5",
              SHELL_TAB_PAD_LOCK,
            )}
          >
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar
        staticNav
        activeHref={scene === "painel" ? "/painel" : undefined}
      />
    </div>
  );
}
