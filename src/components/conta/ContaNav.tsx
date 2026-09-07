"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONTA_NAV, isContaNavActive } from "@/lib/conta-nav";
import { cn } from "@/lib/utils";

export function ContaNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Conta"
      className="grid shrink-0 grid-cols-2 gap-1 sm:grid-cols-3 lg:flex lg:w-52 lg:flex-col lg:overflow-visible"
    >
      {CONTA_NAV.map((item) => {
        const Icon = item.icon;
        if (item.soon) {
          return (
            <span
              key={item.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-1.5 text-xs text-podium-muted/70 lg:min-h-0"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.12em]">
                Em breve
              </span>
            </span>
          );
        }
        const active = isContaNavActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-1.5 text-xs transition lg:min-h-0",
              active
                ? "bg-podium-yellow/15 text-podium-yellow"
                : "text-podium-gray hover:bg-white/5 hover:text-podium-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
