"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import { SHELL_Z } from "@/lib/shell-chrome";
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
    <div
      className={cn(
        "fixed inset-0 flex items-end justify-center p-4 sm:items-center",
        SHELL_Z.confirm,
      )}
    >
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
          "relative w-full max-w-sm overflow-hidden rounded-t-md border border-white/15",
          "bg-podium-navy/80 p-3 shadow-2xl backdrop-blur-2xl sm:rounded-md",
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
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={pending}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={primaryRef}
            type="button"
            variant="primary"
            size="md"
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmIcon}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
