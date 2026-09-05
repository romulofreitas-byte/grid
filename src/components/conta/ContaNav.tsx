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
      className="flex shrink-0 gap-1 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-visible"
    >
      {CONTA_NAV.map((item) => {
        const Icon = item.icon;
        if (item.soon) {
          return (
            <span
              key={item.href}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-podium-muted/70"
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
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
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
