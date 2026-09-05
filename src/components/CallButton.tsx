"use client";

import { useState } from "react";
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
}: {
  telHref: string | null;
  connection: CallConnectionPick | null;
  cnpj: string;
  searchId?: string | null;
  to?: string;
  variant?: "grid" | "ficha" | "cockpit";
  label?: string;
  onCalled?: () => void;
  className?: string;
  titleHint?: string;
  companyName?: string | null;
  phoneLabel?: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  function invalidateAfterCall() {
    qc.invalidateQueries({ queryKey: ["lead", normalizeLeadCnpj(cnpj)] });
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
      if (connection) {
        const res = await fetch("/api/integrations/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: connection.id,
            cnpj,
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
      void recordManualCall({ cnpj, searchId })
        .then(() => invalidateAfterCall())
        .catch(() => undefined);
    },
    onSuccess: () => {
      setOpen(false);
      onCalled?.();
      if (connection) invalidateAfterCall();
    },
  });

  const canOriginate = Boolean(connection);
  const canTel = Boolean(telHref);
  if (!canOriginate && !canTel) return null;

  const idleLabel = label ?? "Ligar";
  const catalogItem = connection
    ? resolveCatalogItem(connection.catalog_id, connection.display_name)
    : undefined;

  const base =
    variant === "cockpit"
      ? buttonClassName({
          variant: "primary",
          size: "md",
          className: cn("w-full gap-2", className),
        })
      : buttonClassName({ variant: "secondary", size: "sm", className });

  const title = callMutation.error
    ? callMutation.error.message
    : titleHint ?? (connection ? callViaLabel(connection) : COPY.callAskTitle);

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
        {callMutation.isPending ? "Ligando…" : idleLabel}
      </button>
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
      />
    </>
  );
}
