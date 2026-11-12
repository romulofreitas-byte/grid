"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { COPY } from "@/lib/copy";
import type { CrmDealCard } from "@/lib/crm/types";
import { BOX_QUEUE_QUERY_KEY } from "@/lib/live-stats";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export async function requestHidePhone(input: {
  phone: string;
  cnpj?: string | null;
  dealId?: string | null;
}): Promise<{ deals: CrmDealCard[] }> {
  const res = await fetch("/api/phones/hide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: input.phone,
      cnpj: input.cnpj ?? undefined,
      dealId: input.dealId ?? undefined,
    }),
  });
  const body = (await res.json()) as { error?: string; deals?: CrmDealCard[] };
  if (!res.ok) throw new Error(body.error ?? "Não foi possível excluir o telefone");
  return { deals: body.deals ?? [] };
}

export function HidePhoneButton({
  phone,
  cnpj,
  dealId,
  className,
  onHidden,
}: {
  phone: string;
  cnpj?: string | null;
  dealId?: string | null;
  className?: string;
  onHidden?: (result: { deals: CrmDealCard[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const result = await requestHidePhone({ phone, cnpj, dealId });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lead"] }),
        qc.invalidateQueries({ queryKey: ["grid"] }),
        qc.invalidateQueries({ queryKey: BOX_QUEUE_QUERY_KEY }),
      ]);
      onHidden?.(result);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o telefone");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        title={COPY.hidePhone}
        aria-label={COPY.hidePhone}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          setError(null);
          setOpen(true);
        }}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-podium-muted transition hover:bg-white/10 hover:text-podium-alert focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40",
          className,
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {open
        ? createPortal(
            <ConfirmDialog
              open={open}
              title={COPY.hidePhoneTitle}
              body={error ?? COPY.hidePhoneBody}
              confirmLabel={COPY.hidePhone}
              pendingLabel={COPY.hidePhonePending}
              pending={pending}
              onClose={() => {
                if (pending) return;
                setOpen(false);
              }}
              onConfirm={() => void confirm()}
            />,
            document.body,
          )
        : null}
    </>
  );
}
