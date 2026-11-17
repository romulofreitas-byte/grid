"use client";

import { Phone } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import type { CallOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CallConfirmDialog({
  open,
  companyName,
  phoneLabel,
  pending = false,
  voip = false,
  error = null,
  step = "dial",
  onClose,
  onConfirm,
  onOutcome,
  onHangup,
  hangupPending = false,
}: {
  open: boolean;
  companyName?: string | null;
  phoneLabel?: string | null;
  pending?: boolean;
  voip?: boolean;
  error?: string | null;
  step?: "dial" | "classify";
  onClose: () => void;
  onConfirm: () => void;
  onOutcome?: (outcome: CallOutcome) => void;
  onHangup?: () => void;
  hangupPending?: boolean;
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
  const classify = step === "classify";

  return (
    <ConfirmDialog
      open={open}
      eyebrowIcon={<Phone className="h-3.5 w-3.5" />}
      title={classify ? COPY.callClassifyTitle : COPY.callAskTitle}
      body={
        classify
          ? COPY.callClassifyBody
          : voip
            ? COPY.callAskBodyVoip
            : COPY.callAskBody
      }
      confirmLabel={COPY.callAskConfirm}
      pendingLabel={classify ? COPY.callClassifyPending : COPY.callAskPending}
      pending={pending}
      confirmIcon={<Phone className="h-3.5 w-3.5" />}
      cancelLabel={classify ? "Agora não" : COPY.callAskCancel}
      actions={
        classify ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={onClose}
            >
              Agora não
            </Button>
            {onHangup ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={pending || hangupPending}
                onClick={onHangup}
              >
                {hangupPending ? COPY.callHangupPending : COPY.callHangup}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={pending}
              onClick={() => onOutcome?.("decisor")}
            >
              {pending ? COPY.callClassifyPending : COPY.callClassifyDecisor}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={pending}
              autoFocus
              onClick={() => onOutcome?.("discagem")}
            >
              {pending ? COPY.callClassifyPending : COPY.callClassifyDiscagem}
            </Button>
          </div>
        ) : undefined
      }
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
      {error ? (
        <p className="mt-3 text-sm text-podium-alert">{error}</p>
      ) : null}
    </ConfirmDialog>
  );
}
