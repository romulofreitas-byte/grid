"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { AnchorPopover } from "@/components/AnchorPopover";
import { ExportMenuItems, type GridExportFormat } from "@/components/ExportDownload";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

const menuItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-podium-gray hover:bg-white/5 hover:text-podium-yellow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-podium-gray";

export function GridMoreMenu({
  qualifyPending,
  unaudited,
  allCost,
  confirmAll,
  batchSizes,
  onQualifyBatch,
  onQualifyAll,
  onAskConfirmAll,
  canExport,
  exportCostHint,
  onPickFormat,
  sendSection,
}: {
  qualifyPending: boolean;
  unaudited: number;
  allCost: number;
  confirmAll: boolean;
  batchSizes: readonly number[];
  onQualifyBatch: (limit: number) => void;
  onQualifyAll: () => void;
  onAskConfirmAll: () => void;
  canExport: boolean;
  exportCostHint: string;
  onPickFormat: (format: GridExportFormat) => void;
  sendSection?: ReactNode;
}) {
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
        title={COPY.maisAcoes}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 px-2 text-[11px] font-medium text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        {COPY.maisAcoes}
      </button>
      <AnchorPopover
        open={open}
        anchorRef={rootRef}
        panelRef={panelRef}
        id={menuId}
        align="end"
        className="w-60 p-1"
      >
        <div role="menu">
          {batchSizes.map((size) => (
            <button
              key={size}
              type="button"
              role="menuitem"
              disabled={qualifyPending || unaudited === 0}
              onClick={() => {
                onQualifyBatch(size);
                setOpen(false);
              }}
              className={menuItemClass}
            >
              Qualificar {size}
            </button>
          ))}
          {confirmAll ? (
            <button
              type="button"
              role="menuitem"
              disabled={qualifyPending || unaudited === 0}
              onClick={() => {
                onQualifyAll();
                setOpen(false);
              }}
              className={cn(menuItemClass, "text-podium-yellow")}
            >
              Confirmar {unaudited} · {allCost} créditos
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              disabled={unaudited === 0}
              onClick={() => onAskConfirmAll()}
              className={menuItemClass}
            >
              Qualificar a lista inteira ({unaudited})
            </button>
          )}
          <div className="my-1 border-t border-white/10" />
          <p className="px-3 py-1.5 text-[10px] leading-snug text-podium-muted">
            {exportCostHint}
          </p>
          <ExportMenuItems
            disabled={!canExport}
            disabledHint={COPY.exportNeedsQualify}
            onPickFormat={onPickFormat}
            onDone={() => setOpen(false)}
          />
          {sendSection ? (
            <>
              <div className="my-1 border-t border-white/10" />
              <div className="px-2 py-1.5">{sendSection}</div>
            </>
          ) : null}
        </div>
      </AnchorPopover>
    </div>
  );
}
