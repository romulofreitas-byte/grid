"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, SlidersHorizontal, Trash2 } from "lucide-react";
import { ExportDownload } from "@/components/ExportDownload";
import { COPY } from "@/lib/copy";
import { largadaEditHref } from "@/lib/back";
import type { Search } from "@/lib/types";
import { cn } from "@/lib/utils";

const menuItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-podium-gray hover:bg-white/5 hover:text-podium-yellow";

export function ListSearchMenu({
  search,
  onDeleted,
}: {
  search: Search;
  onDeleted: (searchId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setConfirming(false);
        setError(null);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirming(false);
        setError(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/search/${search.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Não foi possível excluir");
      onDeleted(search.id);
    } catch {
      setPending(false);
      setError("Não foi possível excluir. Tente de novo.");
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        title="Mais ações"
        onClick={() => {
          setOpen((value) => !value);
          setConfirming(false);
          setError(null);
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Mais ações</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-white/10 bg-podium-navy p-1 shadow-2xl"
        >
          {confirming ? (
            <div className="space-y-2 px-2 py-2">
              <p className="text-xs text-podium-muted">
                Excluir “{search.nome}”? Isso não dá para desfazer.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setConfirming(false);
                    setError(null);
                  }}
                  className="flex-1 rounded-lg border border-white/15 px-2 py-1.5 text-xs font-bold text-podium-gray hover:border-white/30 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void onDelete()}
                  className="flex-1 rounded-lg bg-red-500/15 px-2 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/25 disabled:opacity-40"
                >
                  {pending ? "Excluindo…" : "Excluir"}
                </button>
              </div>
              {error ? <p className="text-xs text-red-400">{error}</p> : null}
            </div>
          ) : (
            <>
              <Link
                href={largadaEditHref(search.id, "listas")}
                role="menuitem"
                className={menuItemClass}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {COPY.ajustar}
              </Link>
              <ExportDownload
                searchId={search.id}
                format="xlsx"
                label="Excel"
                wrapperClassName="w-full items-stretch"
                className={cn(
                  menuItemClass,
                  "border-0 hover:border-transparent",
                )}
              />
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirming(true)}
                className={cn(menuItemClass, "hover:text-red-400")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
