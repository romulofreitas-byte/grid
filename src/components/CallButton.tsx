"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { CallConfirmDialog } from "@/components/CallConfirmDialog";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { buttonClassName } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import { resolveCatalogItem } from "@/lib/integrations/catalog";
import {
  callViaLabel,
  type CallConnectionPick,
} from "@/lib/integrations/call-target";
import { normalizeLeadCnpj } from "@/lib/lead-query";
import { cn } from "@/lib/utils";

async function recordManualCall(input: {
  cnpj: string;
  searchId?: string | null;
}) {
  const res = await fetch("/api/profile/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cnpj: normalizeLeadCnpj(input.cnpj),
      searchId: input.searchId ?? undefined,
    }),
  });
  const body = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Não foi possível registrar");
}

function usableCnpj(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

export function CallButton({
  telHref,
  connection,
  cnpj,
  searchId,
  to,
  variant = "grid",
  label,
  onCalled,
  className,
  titleHint,
  companyName,
  phoneLabel,
  skipRecord = false,
  iconOnly = false,
}: {
  telHref: string | null;
  connection: CallConnectionPick | null;
  cnpj?: string | null;
  searchId?: string | null;
  to?: string;
  variant?: "grid" | "ficha" | "cockpit" | "box" | "card";
  label?: string;
  onCalled?: () => void;
  className?: string;
  titleHint?: string;
  companyName?: string | null;
  phoneLabel?: string | null;
  /** CRM cards record via complete/log themselves. */
  skipRecord?: boolean;
  iconOnly?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const dialCnpj = usableCnpj(cnpj);
  const originate = Boolean(connection && dialCnpj);

  function invalidateAfterCall() {
    if (dialCnpj) {
      qc.invalidateQueries({ queryKey: ["lead", dialCnpj] });
    }
    qc.invalidateQueries({ queryKey: ["pilot-stats"] });
    qc.invalidateQueries(
      searchId
        ? { queryKey: ["grid", searchId] }
        : { queryKey: ["grid"] },
    );
    qc.invalidateQueries({ queryKey: ["integration-jobs"] });
  }

  const callMutation = useMutation({
    mutationFn: async () => {
      if (originate && connection && dialCnpj) {
        const res = await fetch("/api/integrations/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: connection.id,
            cnpj: dialCnpj,
            searchId: searchId ?? null,
            to,
          }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Não foi possível ligar");
        return;
      }
      if (!telHref) throw new Error("Sem telefone");
      window.location.href = telHref;
      if (skipRecord || !dialCnpj) return;
      void recordManualCall({ cnpj: dialCnpj, searchId })
        .then(() => invalidateAfterCall())
        .catch(() => undefined);
    },
    onSuccess: () => {
      setOpen(false);
      onCalled?.();
      if (originate) invalidateAfterCall();
    },
  });

  const canTel = Boolean(telHref);
  if (!originate && !canTel) return null;

  const idleLabel = label ?? "Ligar";
  const hideLabel = iconOnly || variant === "card";
  const catalogItem =
    originate && connection && !hideLabel
      ? resolveCatalogItem(connection.catalog_id, connection.display_name)
      : undefined;

  const base =
    variant === "card"
      ? cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-podium-muted transition",
          "hover:bg-white/10 hover:text-podium-yellow",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40",
          "disabled:opacity-40",
          className,
        )
      : variant === "box" && iconOnly
        ? cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition",
            "hover:bg-zinc-100 hover:text-amber-700",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40",
            "disabled:opacity-40",
            className,
          )
      : variant === "cockpit"
        ? buttonClassName({
            variant: "primary",
            size: "md",
            className: cn("w-full gap-2", className),
          })
        : variant === "box"
          ? buttonClassName({
              variant: "secondary",
              size: "sm",
              className: cn(
                "border-zinc-200 bg-white text-zinc-800 shadow-none",
                "hover:border-amber-400 hover:bg-amber-50 hover:text-zinc-900 hover:shadow-none",
                className,
              ),
            })
          : buttonClassName({ variant: "secondary", size: "sm", className });

  const title = callMutation.error
    ? callMutation.error.message
    : titleHint ?? (originate && connection ? callViaLabel(connection) : COPY.callAskTitle);

  return (
    <>
      <button
        type="button"
        disabled={callMutation.isPending}
        onClick={() => setOpen(true)}
        aria-label={title}
        title={title}
        className={cn(base)}
      >
        {catalogItem ? (
          <IntegrationLogo
            item={catalogItem}
            size="xs"
            active
            className="bg-black/10"
          />
        ) : (
          <Phone className={variant === "cockpit" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        )}
        {hideLabel ? null : callMutation.isPending ? "Ligando…" : idleLabel}
      </button>
      {open
        ? createPortal(
            <CallConfirmDialog
              open={open}
              companyName={companyName}
              phoneLabel={phoneLabel}
              pending={callMutation.isPending}
              onClose={() => {
                if (callMutation.isPending) return;
                setOpen(false);
              }}
              onConfirm={() => callMutation.mutate()}
            />,
            document.body,
          )
        : null}
    </>
  );
}
