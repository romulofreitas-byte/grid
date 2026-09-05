"use client";

import { useEffect, useId } from "react";
import { Phone, X } from "lucide-react";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function CallConfirmDialog({
  open,
  companyName,
  phoneLabel,
  pending = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  companyName?: string | null;
  phoneLabel?: string | null;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={COPY.callAskCancel}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        disabled={pending}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-t-2xl border border-white/15",
          "bg-podium-navy/80 p-5 shadow-2xl backdrop-blur-2xl sm:rounded-2xl",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
              <Phone className="h-3.5 w-3.5" />
              {COPY.callAskEyebrow}
            </p>
            <h2 id={titleId} className="mt-1 text-base font-semibold text-podium-white">
              {COPY.callAskTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-podium-muted hover:bg-white/5 hover:text-podium-white disabled:opacity-40"
            title={COPY.callAskCancel}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{COPY.callAskCancel}</span>
          </button>
        </div>
        {companyName ? (
          <p className="mt-3 truncate text-sm font-medium text-podium-white">
            {companyName}
          </p>
        ) : null}
        {phoneLabel ? (
          <p className="mt-0.5 text-sm tabular-nums text-podium-gray">{phoneLabel}</p>
        ) : null}
        <p className="mt-3 text-sm text-podium-muted">{COPY.callAskBody}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-podium-muted hover:bg-white/5 hover:text-podium-white disabled:opacity-40"
          >
            {COPY.callAskCancel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-podium-yellow px-3 py-1.5 text-sm font-extrabold text-podium-navy hover:brightness-110 disabled:opacity-50"
          >
            <Phone className="h-3.5 w-3.5" />
            {pending ? COPY.callAskPending : COPY.callAskConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
