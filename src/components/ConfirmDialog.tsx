"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function ConfirmDialog({
  open,
  eyebrow = COPY.confirmEyebrow,
  eyebrowIcon,
  title,
  body,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = COPY.confirmCancel,
  pending = false,
  confirmIcon,
  onClose,
  onConfirm,
}: {
  open: boolean;
  eyebrow?: ReactNode;
  eyebrowIcon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  confirmIcon?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);

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
    const frame = window.requestAnimationFrame(() => {
      primaryRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={typeof cancelLabel === "string" ? cancelLabel : COPY.confirmCancel}
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
              {eyebrowIcon}
              {eyebrow}
            </p>
            <h2 id={titleId} className="mt-1 text-base font-semibold text-podium-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-podium-muted hover:bg-white/5 hover:text-podium-white disabled:opacity-40"
            title={typeof cancelLabel === "string" ? cancelLabel : COPY.confirmCancel}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{cancelLabel}</span>
          </button>
        </div>
        {children}
        {body ? (
          <p className="mt-3 text-sm text-podium-muted">{body}</p>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-podium-muted hover:bg-white/5 hover:text-podium-white disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            ref={primaryRef}
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-podium-yellow px-3 py-1.5 text-sm font-extrabold text-podium-navy hover:brightness-110 disabled:opacity-50"
          >
            {confirmIcon}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
