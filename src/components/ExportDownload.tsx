"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { usePaywall } from "@/components/PaywallDialog";
import { Button } from "@/components/ui/Button";
import { parseBillingGate } from "@/lib/billing/paywall";
import { cn } from "@/lib/utils";

export function ExportDownload({
  searchId,
  format,
  label,
  className,
  wrapperClassName,
  costHint,
  disabled,
  disabledHint,
}: {
  searchId: string;
  format: "xlsx" | "csv" | "pdf";
  label: string;
  className?: string;
  wrapperClassName?: string;
  costHint?: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const { openPaywall } = usePaywall();
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (disabled) return;
    setError(null);
    const res = await fetch(`/api/export/${searchId}?format=${format}`);
    if (!res.ok) {
      const json: unknown = await res.json().catch(() => ({}));
      const gate = parseBillingGate(res.status, json);
      if (gate) {
        openPaywall({
          kind: gate.kind,
          feature: "export",
          needed: gate.needed,
          available: gate.available,
        });
        return;
      }
      const message =
        typeof json === "object" &&
        json !== null &&
        "error" in json &&
        typeof json.error === "string"
          ? json.error
          : "Não foi possível exportar";
      setError(message);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grid-${searchId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <span
      className={cn(
        "inline-flex flex-col gap-1",
        wrapperClassName ?? "items-end",
      )}
    >
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => void run()}
        className={className}
        disabled={disabled}
        title={disabled ? disabledHint : costHint}
      >
        <Download className="h-3.5 w-3.5" />
        {label}
        {costHint ? (
          <span className="text-[10px] font-medium opacity-70">{costHint}</span>
        ) : null}
      </Button>
      {error ? (
        <span className="max-w-xs text-right text-[11px] text-podium-yellow">
          {error}
        </span>
      ) : null}
    </span>
  );
}
