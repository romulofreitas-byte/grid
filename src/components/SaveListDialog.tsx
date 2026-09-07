"use client";

import { useEffect, useId, useRef } from "react";
import { BookmarkPlus, Flag, List, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function SaveListDialog({
  open,
  saved,
  name,
  pending,
  error,
  onClose,
  onNameChange,
  onSubmit,
}: {
  open: boolean;
  saved: boolean;
  name: string;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const canSave = name.trim().length > 0 && !pending;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={COPY.salvarListaClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        disabled={pending}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-t-md border border-white/15",
          "bg-podium-navy/80 p-3 shadow-2xl backdrop-blur-2xl sm:rounded-md",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
              <BookmarkPlus className="h-3.5 w-3.5" />
              {COPY.salvarListaEyebrow}
            </p>
            <h2 id={titleId} className="mt-1 text-base font-semibold text-podium-white">
              {saved ? COPY.renomearLista : COPY.salvarEstaLista}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-podium-muted hover:bg-white/5 hover:text-podium-white disabled:opacity-40"
            title={COPY.salvarListaClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{COPY.salvarListaClose}</span>
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          <li className="flex items-start gap-3 rounded-md bg-white/5 px-3 py-2">
            <List className="mt-0.5 h-4 w-4 shrink-0 text-podium-yellow" />
            <span className="text-sm text-podium-gray">{COPY.salvarMotivoListas}</span>
          </li>
          <li className="flex items-start gap-3 rounded-md bg-white/5 px-3 py-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-podium-yellow" />
            <span className="text-sm text-podium-gray">{COPY.salvarMotivoOrdem}</span>
          </li>
          <li className="flex items-start gap-3 rounded-md bg-white/5 px-3 py-2">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-podium-yellow" />
            <span className="text-sm text-podium-gray">{COPY.salvarMotivoCrm}</span>
          </li>
        </ul>

        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) onSubmit();
          }}
        >
          <label
            htmlFor={inputId}
            className="block text-[10px] font-medium uppercase tracking-[0.12em] text-podium-muted"
          >
            {COPY.salvarListaName}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={COPY.salvarListaPlaceholder}
            className="mt-1.5 w-full rounded-md border border-white/10 bg-podium-panel px-2.5 py-1.5 text-xs text-podium-white outline-none focus:border-podium-yellow/40"
          />
          {error ? (
            <p className="mt-2 text-sm text-podium-yellow">{error}</p>
          ) : null}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={onClose}
            >
              {COPY.salvarListaClose}
            </Button>
            <Button
              type="submit"
              variant={saved ? "secondary" : "primary"}
              size="md"
              disabled={!canSave}
            >
              <BookmarkPlus className="h-4 w-4" />
              {pending
                ? COPY.salvarListaPending
                : saved
                  ? COPY.renomearLista
                  : COPY.salvarLista}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
