"use client";

import { Phone } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { COPY } from "@/lib/copy";

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
        <p className="mt-0.5 text-sm tabular-nums text-podium-gray">{phoneLabel}</p>
      ) : null}
    </ConfirmDialog>
  );
}
