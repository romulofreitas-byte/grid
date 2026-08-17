"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { FAQ_ITEMS, faqGrouped, filterFaq } from "@/lib/faq";
import { cn } from "@/lib/utils";

export function FaqList({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(
    () => faqGrouped(filterFaq(FAQ_ITEMS, query)),
    [query],
  );

  return (
    <div className={cn("space-y-5", className)}>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-podium-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar dúvida"
          className="w-full rounded-xl border border-white/10 bg-podium-panel py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-podium-muted focus:border-podium-yellow/40"
        />
      </label>

      {groups.length === 0 ? (
        <p className="text-sm text-podium-muted">
          Nenhuma dúvida com esse termo. Fale no WhatsApp se ainda precisar.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-yellow">
              {group.category}
            </h3>
            <div className={cn("space-y-2", compact && "space-y-1.5")}>
              {group.items.map((item) => (
                <details
                  key={item.id}
                  className="group rounded-xl border border-white/10 bg-white/[0.04] open:border-podium-yellow/25"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-podium-white [&::-webkit-details-marker]:hidden">
                    <span>{item.question}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-podium-muted transition group-open:rotate-180 group-open:text-podium-yellow" />
                  </summary>
                  <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-podium-gray">
                    <p>{item.answer}</p>
                    {item.links?.length ? (
                      <p className="flex flex-wrap gap-x-3 gap-y-1">
                        {item.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="font-bold text-podium-yellow hover:underline"
                          >
                            {link.label} →
                          </Link>
                        ))}
                      </p>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
