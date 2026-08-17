"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp, X } from "lucide-react";
import { FaqList } from "@/components/FaqList";
import { SupportWhatsAppButton } from "@/components/SupportWhatsAppButton";
import { displayName } from "@/lib/pilot-profile";
import { supportWhatsAppHref } from "@/lib/support";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SupportDock() {
  const pathname = usePathname();
  const titleId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return null;
      return (await res.json()) as Profile;
    },
  });
  const name = profileQuery.data ? displayName(profileQuery.data) : null;
  const hasWhatsApp = Boolean(supportWhatsAppHref({ name, pathname }));

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "fixed right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-podium-yellow text-podium-navy shadow-lg shadow-black/40 transition hover:brightness-110",
          "bottom-24 md:bottom-6 md:right-6",
          open && "hidden",
        )}
        title="Dúvidas e suporte"
      >
        <CircleHelp className="h-6 w-6" />
        <span className="sr-only">Abrir dúvidas e suporte</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fechar dúvidas"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 flex max-h-[min(85vh,720px)] flex-col rounded-t-2xl border border-white/10 bg-podium-navy shadow-2xl md:inset-auto md:bottom-6 md:right-6 md:h-[min(640px,calc(100vh-3rem))] md:w-[400px] md:rounded-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-podium-yellow">
                  Suporte
                </p>
                <h2 id={titleId} className="text-base font-extrabold">
                  Dúvidas
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-podium-muted hover:bg-white/5 hover:text-podium-white"
                title="Fechar"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <FaqList compact />
            </div>
            {hasWhatsApp ? (
              <footer className="space-y-2 border-t border-white/10 px-4 py-3">
                <p className="text-xs text-podium-muted">
                  Não achou? Chama o atendimento.
                </p>
                <SupportWhatsAppButton
                  name={name}
                  pathname={pathname}
                  className="w-full"
                />
              </footer>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
