"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { usePaywall } from "@/components/PaywallDialog";
import { AnchorPopover } from "@/components/AnchorPopover";
import { Badge } from "@/components/ui/Badge";
import { parseBillingGate } from "@/lib/billing/paywall";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export type GridExportFormat = "xlsx" | "csv" | "pdf";

export const GRID_EXPORT_FORMATS: {
  format: GridExportFormat;
  label: string;
}[] = [
  { format: "xlsx", label: "Excel" },
  { format: "csv", label: "CSV" },
  { format: "pdf", label: "PDF" },
];

export function useGridExport(searchId: string) {
  const { openPaywall } = usePaywall();
  const [error, setError] = useState<string | null>(null);
  const [pendingFormat, setPendingFormat] = useState<GridExportFormat | null>(
    null,
  );

  const runExport = useCallback(
    async (format: GridExportFormat) => {
      setError(null);
      setPendingFormat(format);
      try {
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
      } finally {
        setPendingFormat(null);
      }
    },
    [openPaywall, searchId],
  );

  return { runExport, error, pendingFormat };
}

const menuItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-podium-gray hover:bg-white/5 hover:text-podium-yellow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-podium-gray";

export function ExportMenu({
  searchId,
  disabled,
  disabledHint,
  costHint,
}: {
  searchId: string;
  disabled?: boolean;
  disabledHint?: string;
  costHint?: string;
}) {
  const { runExport, error, pendingFormat } = useGridExport(searchId);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !panelRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        title={disabled ? disabledHint : COPY.exportar}
        onClick={() => setOpen((value) => !value)}
        className="rounded-md"
      >
        <Badge
          variant="accent"
          className={cn(
            "cursor-pointer gap-1 py-1 pr-1.5",
            disabled && "opacity-50",
          )}
        >
          <Download className="h-3 w-3" />
          {COPY.exportar}
          <ChevronDown className="h-3 w-3 opacity-80" />
        </Badge>
      </button>
      <AnchorPopover
        open={open}
        anchorRef={rootRef}
        panelRef={panelRef}
        id={menuId}
        align="end"
        className="w-52 p-1"
      >
        <div role="menu">
          {costHint ? (
            <p className="px-3 py-1.5 text-[10px] leading-snug text-podium-muted">
              {costHint}
            </p>
          ) : null}
          {GRID_EXPORT_FORMATS.map((item) => (
            <button
              key={item.format}
              type="button"
              role="menuitem"
              disabled={disabled || pendingFormat !== null}
              title={disabled ? disabledHint : undefined}
              onClick={() => {
                if (disabled) return;
                void runExport(item.format).then(() => setOpen(false));
              }}
              className={menuItemClass}
            >
              <Download className="h-3.5 w-3.5" />
              {pendingFormat === item.format ? "Exportando…" : item.label}
            </button>
          ))}
          {error ? (
            <p className="px-3 py-1.5 text-[11px] text-podium-yellow">{error}</p>
          ) : null}
        </div>
      </AnchorPopover>
    </div>
  );
}

export function ExportMenuItems({
  searchId,
  disabled,
  disabledHint,
  onDone,
}: {
  searchId: string;
  disabled?: boolean;
  disabledHint?: string;
  onDone?: () => void;
}) {
  const { runExport, error, pendingFormat } = useGridExport(searchId);
  return (
    <>
      {GRID_EXPORT_FORMATS.map((item) => (
        <button
          key={item.format}
          type="button"
          role="menuitem"
          disabled={disabled || pendingFormat !== null}
          title={disabled ? disabledHint : undefined}
          onClick={() => {
            if (disabled) return;
            void runExport(item.format).then(() => onDone?.());
          }}
          className={menuItemClass}
        >
          <Download className="h-3.5 w-3.5" />
          {pendingFormat === item.format ? "Exportando…" : item.label}
        </button>
      ))}
      {error ? (
        <p className="px-3 py-1.5 text-[11px] text-podium-yellow">{error}</p>
      ) : null}
    </>
  );
}
