"use client";

import { Phone } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [phoneLabel, open]);

  async function copyPhone(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!phoneLabel) return;
    try {
      await navigator.clipboard.writeText(phoneLabel);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      return;
    }
  }

  const copyLabel = copied ? COPY.callAskCopied : COPY.callAskCopyPhone;

  return (
    <ConfirmDialog
      open={open}
      eyebrowIcon={<Phone className="h-3.5 w-3.5" />}
      title={COPY.callAskTitle}
      body={COPY.callAskBody}
      confirmLabel={COPY.callAskConfirm}
      pendingLabel={COPY.callAskPending}
      pending={pending}
      confirmIcon={<Phone className="h-3.5 w-3.5" />}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      {companyName ? (
        <p className="mt-3 truncate text-sm font-medium text-podium-white">
          {companyName}
        </p>
      ) : null}
      {phoneLabel ? (
        <button
          type="button"
          title={copyLabel}
          aria-label={copyLabel}
          onClick={(event) => void copyPhone(event)}
          className={cn(
            "inline-flex cursor-pointer items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-sm tabular-nums text-podium-gray transition",
            "hover:border-white/20 hover:bg-white/[0.08] hover:text-podium-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40",
            companyName ? "mt-0.5" : "mt-3",
          )}
        >
          {copied ? COPY.callAskCopied : phoneLabel}
        </button>
      ) : null}
    </ConfirmDialog>
  );
}
