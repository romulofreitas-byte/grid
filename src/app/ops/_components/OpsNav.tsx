"use client";

import {
  parseOpsTab,
  type OpsTab,
} from "@/lib/ops/filters";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TABS: { id: OpsTab; label: string }[] = [
  { id: "visao", label: "Visão" },
  { id: "ranking", label: "Ranking" },
  { id: "conta", label: "Conta" },
  { id: "usabilidade", label: "Usabilidade" },
  { id: "mercado", label: "Mercado" },
];

export function OpsNav({ tab }: { tab: OpsTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setTab(next: OpsTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "visao") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <nav
      aria-label="Seções de operações"
      className="flex flex-wrap gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] p-1"
    >
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setTab(item.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition",
            tab === item.id
              ? "bg-podium-yellow/15 text-podium-yellow"
              : "text-podium-gray hover:bg-white/5 hover:text-podium-white",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function useOpsTab(): OpsTab {
  const searchParams = useSearchParams();
  return parseOpsTab(searchParams);
}
