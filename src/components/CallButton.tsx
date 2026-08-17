"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { IntegrationLogo } from "@/components/IntegrationLogo";
import { resolveCatalogItem } from "@/lib/integrations/catalog";
import {
  callViaLabel,
  type CallConnectionPick,
} from "@/lib/integrations/call-target";
import { cn } from "@/lib/utils";

export function CallButton({
  telHref,
  connection,
  cnpj,
  searchId,
  to,
  variant = "grid",
  label,
  onCalled,
}: {
  telHref: string | null;
  connection: CallConnectionPick | null;
  cnpj: string;
  searchId?: string | null;
  to?: string;
  variant?: "grid" | "ficha" | "cockpit";
  label?: string;
  onCalled?: () => void;
}) {
  const qc = useQueryClient();
  const callMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: connection?.id,
          cnpj,
          searchId: searchId ?? null,
          to,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível ligar");
    },
    onSuccess: () => {
      onCalled?.();
      qc.invalidateQueries({ queryKey: ["lead", cnpj] });
      qc.invalidateQueries({ queryKey: ["pilot-stats"] });
      qc.invalidateQueries({ queryKey: ["integration-jobs"] });
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
      ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-podium-yellow px-8 py-4 text-base font-extrabold text-podium-navy disabled:opacity-40 sm:w-auto"
      : variant === "ficha"
        ? "inline-flex items-center gap-1 rounded-xl border border-white/15 px-2.5 py-1 text-xs font-bold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-yellow disabled:opacity-40"
        : "inline-flex h-9 items-center gap-1 rounded-xl border border-white/15 px-2.5 text-xs font-extrabold text-podium-gray hover:border-podium-yellow/40 hover:text-podium-yellow disabled:opacity-40";

  if (connection) {
    const title = callMutation.error
      ? callMutation.error.message
      : callViaLabel(connection);
    return (
      <button
        type="button"
        disabled={callMutation.isPending}
        onClick={() => callMutation.mutate()}
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
    );
  }

  if (!telHref) return null;

  return (
    <a
      href={telHref}
      aria-label={idleLabel}
      title={idleLabel}
      onClick={() => onCalled?.()}
      className={cn(base)}
    >
      <Phone className={variant === "cockpit" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {idleLabel}
    </a>
  );
}
