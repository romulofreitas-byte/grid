"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneOff } from "lucide-react";
import { CallConfirmDialog } from "@/components/CallConfirmDialog";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { buttonClassName } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";
import { resolveCatalogItem } from "@/lib/integrations/catalog";
import {
  canPlaceVoipCall,
  type CallConnectionPick,
} from "@/lib/integrations/call-target";
import { normalizeLeadCnpj } from "@/lib/lead-query";
import { invalidateLiveStats } from "@/lib/live-stats";
import { cn } from "@/lib/utils";

const HANGUP_IDLE_MS = 90_000;

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
  dealId,
  disabled = false,
  onConfirmOpenChange,
}: {
  telHref: string | null;
  connection: CallConnectionPick | null;
  cnpj?: string | null;
  searchId?: string | null;
  to?: string;
  dealId?: string | null;
  variant?: "grid" | "ficha" | "cockpit" | "card" | "crm" | "inline";
  label?: string;
  onCalled?: () => void;
  className?: string;
  titleHint?: string;
  companyName?: string | null;
  phoneLabel?: string | null;
  /** CRM cards record via complete/log themselves. */
  skipRecord?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  onConfirmOpenChange?: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [liveCall, setLiveCall] = useState<{
    connectionId: string;
    externalId: string;
  } | null>(null);
  const dialCnpj = usableCnpj(cnpj);
  const originate = canPlaceVoipCall(connection, { cnpj: dialCnpj, to });

  function setConfirmOpen(next: boolean) {
    setOpen(next);
    onConfirmOpenChange?.(next);
  }

  useEffect(() => {
    if (!liveCall) return;
    const timer = window.setTimeout(() => setLiveCall(null), HANGUP_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [liveCall]);

  function invalidateAfterCall() {
    if (dialCnpj) {
      qc.invalidateQueries({ queryKey: ["lead", dialCnpj] });
    }
    qc.invalidateQueries(
      searchId
        ? { queryKey: ["grid", searchId] }
        : { queryKey: ["grid"] },
    );
    qc.invalidateQueries({ queryKey: ["integration-jobs"] });
    void invalidateLiveStats(qc);
  }

  const callMutation = useMutation({
    mutationFn: async () => {
      if (originate && connection) {
        const res = await fetch("/api/integrations/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: connection.id,
            cnpj: dialCnpj ?? undefined,
            searchId: searchId ?? null,
            to,
            dealId: dealId ?? undefined,
          }),
        });
        const body = (await res.json()) as {
          error?: string;
          externalId?: string | null;
          hangup?: boolean;
        };
        if (!res.ok) throw new Error(body.error ?? "Não foi possível ligar");
        if (body.hangup && body.externalId) {
          return { hangup: true as const, externalId: body.externalId };
        }
        return { hangup: false as const };
      }
      if (!telHref) throw new Error("Sem telefone");
      window.location.href = telHref;
      if (skipRecord || !dialCnpj) return { hangup: false as const };
      await recordManualCall({ cnpj: dialCnpj, searchId });
      return { hangup: false as const };
    },
    onSuccess: (result) => {
      setConfirmOpen(false);
      if (result.hangup && connection) {
        setLiveCall({ connectionId: connection.id, externalId: result.externalId });
      }
      onCalled?.();
      if (originate || !skipRecord) invalidateAfterCall();
    },
  });

  const hangupMutation = useMutation({
    mutationFn: async () => {
      if (!liveCall) throw new Error("Chamada sem identificador");
      const res = await fetch("/api/integrations/call/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(liveCall),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível desligar");
    },
    onSuccess: () => setLiveCall(null),
  });

  const canTel = Boolean(telHref);
  if (!originate && !canTel) return null;

  const live = Boolean(liveCall);
  const idleLabel = live ? COPY.callHangup : (label ?? "Ligar");
  const hideLabel = iconOnly || variant === "card";
  const showCatalog =
    originate && connection && !hideLabel && !live && variant !== "crm" && variant !== "inline";
  const catalogItem = showCatalog
    ? resolveCatalogItem(connection!.catalog_id, connection!.display_name)
    : undefined;
  const pending = live ? hangupMutation.isPending : callMutation.isPending;
  const actionError = live ? hangupMutation.error : callMutation.error;

  const base =
    variant === "card"
      ? cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-podium-muted transition",
          "hover:bg-white/10 hover:text-podium-yellow",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40",
          "disabled:opacity-40",
          className,
        )
      : variant === "crm"
        ? cn(
            "inline-flex min-h-11 items-center gap-1 rounded-md bg-podium-yellow px-3 text-sm font-medium text-podium-navy hover:brightness-110 disabled:opacity-50 md:min-h-0 md:px-2.5 md:py-1 md:text-[11px]",
            className,
          )
        : variant === "inline"
          ? cn(
              "inline-flex items-center gap-0.5 text-[10px] text-podium-muted hover:text-podium-white disabled:opacity-50",
              className,
            )
          : variant === "cockpit"
            ? buttonClassName({
                variant: "primary",
                size: "md",
                className: cn("w-full gap-2", className),
              })
            : buttonClassName({ variant: "secondary", size: "sm", className });

  const title = actionError
    ? actionError.message
    : live
      ? COPY.callHangupTitle
      : originate
        ? COPY.callVoipHint
        : titleHint ?? COPY.callAskTitle;

  return (
    <>
      <span
        className={cn(
          "inline-flex flex-col gap-1",
          variant === "cockpit" ? "w-full" : "items-start",
        )}
      >
        <button
          type="button"
          disabled={pending || disabled}
          onClick={() => {
            if (live) {
              hangupMutation.mutate();
              return;
            }
            setConfirmOpen(true);
          }}
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
          ) : live ? (
            <PhoneOff className={variant === "cockpit" ? "h-4 w-4" : "h-3.5 w-3.5"} />
          ) : (
            <Phone className={variant === "cockpit" ? "h-4 w-4" : "h-3.5 w-3.5"} />
          )}
          {hideLabel
            ? null
            : pending
              ? live
                ? COPY.callHangupPending
                : "Ligando…"
              : idleLabel}
        </button>
        {actionError && !open ? (
          <p className="max-w-64 text-[11px] text-podium-alert">{actionError.message}</p>
        ) : null}
      </span>
      {open
        ? createPortal(
            <CallConfirmDialog
              open={open}
              companyName={companyName}
              phoneLabel={phoneLabel}
              pending={callMutation.isPending}
              voip={originate}
              error={callMutation.error?.message ?? null}
              onClose={() => {
                if (callMutation.isPending) return;
                setConfirmOpen(false);
              }}
              onConfirm={() => callMutation.mutate()}
            />,
            document.body,
          )
        : null}
    </>
  );
}
