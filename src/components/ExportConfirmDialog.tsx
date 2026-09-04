"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Coins, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  GRID_EXPORT_FORMATS,
  useGridExport,
  type GridExportFormat,
} from "@/components/ExportDownload";
import { creditsPhrase } from "@/lib/billing/catalog";
import { isBillingGateError, RECARGA_URL } from "@/lib/billing/paywall";
import { COPY } from "@/lib/copy";
import { parseExportQuote, type ExportQuote } from "@/lib/export/quote";
import { cn } from "@/lib/utils";

export type ExportCostIntent =
  | { kind: "export"; format: GridExportFormat }
  | { kind: "push"; connectionId: string };

function formatLabel(format: GridExportFormat): string {
  return (
    GRID_EXPORT_FORMATS.find((item) => item.format === format)?.label ?? format
  );
}

function intentTitle(intent: ExportCostIntent): string {
  if (intent.kind === "push") return COPY.exportCostTitlePush;
  return COPY.exportCostTitleExport.replace("{format}", formatLabel(intent.format));
}

function companiesLine(n: number): string {
  return n === 1
    ? COPY.exportCostCompaniesOne
    : COPY.exportCostCompaniesMany.replace("{n}", String(n));
}

function detailLine(chargeable: number, unitCost: number): string {
  return chargeable === 1
    ? COPY.exportCostDetailOne.replace("{unit}", String(unitCost))
    : COPY.exportCostDetailMany
        .replace("{n}", String(chargeable))
        .replace("{unit}", String(unitCost));
}

function alreadyBilledLine(skipped: number): string | null {
  if (skipped <= 0) return null;
  return skipped === 1
    ? COPY.exportCostAlreadyBilledOne
    : COPY.exportCostAlreadyBilledMany.replace("{n}", String(skipped));
}

export function useExportCostConfirm({
  searchId,
  onPush,
}: {
  searchId: string;
  onPush: (connectionId: string) => Promise<unknown>;
}) {
  const { runExport } = useGridExport(searchId);
  const [intent, setIntent] = useState<ExportCostIntent | null>(null);
  const [quote, setQuote] = useState<ExportQuote | null>(null);
  const [quotePending, setQuotePending] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const close = useCallback(() => {
    if (confirming) return;
    setIntent(null);
    setQuote(null);
    setQuotePending(false);
    setQuoteError(null);
    setActionError(null);
  }, [confirming]);

  const askExport = useCallback((format: GridExportFormat) => {
    setQuote(null);
    setQuoteError(null);
    setActionError(null);
    setIntent({ kind: "export", format });
  }, []);

  const askPush = useCallback((connectionId: string) => {
    setQuote(null);
    setQuoteError(null);
    setActionError(null);
    setIntent({ kind: "push", connectionId });
  }, []);

  useEffect(() => {
    if (!intent) return;
    const ac = new AbortController();
    setQuotePending(true);
    setQuoteError(null);
    const url =
      intent.kind === "export"
        ? `/api/export/${searchId}/quote?format=${intent.format}`
        : `/api/export/${searchId}/quote`;
    void (async () => {
      try {
        const res = await fetch(url, { signal: ac.signal });
        const json: unknown = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        if (!res.ok) {
          const message =
            typeof json === "object" &&
            json !== null &&
            "error" in json &&
            typeof json.error === "string"
              ? json.error
              : "Não foi possível calcular o custo";
          setQuoteError(message);
          return;
        }
        const parsed = parseExportQuote(json);
        if (!parsed) {
          setQuoteError("Não foi possível calcular o custo");
          return;
        }
        setQuote(parsed);
      } catch (err) {
        if (
          ac.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        setQuoteError("Não foi possível calcular o custo");
      } finally {
        if (!ac.signal.aborted) setQuotePending(false);
      }
    })();
    return () => ac.abort();
  }, [intent, searchId]);

  const confirm = useCallback(async () => {
    if (!intent || !quote || confirming) return;
    if (quote.needed > quote.available) return;
    setConfirming(true);
    setActionError(null);
    try {
      if (intent.kind === "export") {
        const result = await runExport(intent.format);
        if (result.status === "error") {
          setActionError(result.message);
          return;
        }
        setIntent(null);
        setQuote(null);
        return;
      }
      await onPush(intent.connectionId);
      setIntent(null);
      setQuote(null);
    } catch (err) {
      if (isBillingGateError(err)) {
        setIntent(null);
        setQuote(null);
        return;
      }
      setActionError(
        err instanceof Error ? err.message : "Não foi possível concluir",
      );
    } finally {
      setConfirming(false);
    }
  }, [confirming, intent, onPush, quote, runExport]);

  return {
    askExport,
    askPush,
    dialogProps: {
      open: intent !== null,
      intent,
      quote,
      quotePending,
      quoteError,
      actionError,
      confirming,
      onClose: close,
      onConfirm: confirm,
    },
  };
}

export function ExportConfirmDialog({
  open,
  intent,
  quote,
  quotePending,
  quoteError,
  actionError,
  confirming,
  onClose,
  onConfirm,
}: {
  open: boolean;
  intent: ExportCostIntent | null;
  quote: ExportQuote | null;
  quotePending: boolean;
  quoteError: string | null;
  actionError: string | null;
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const recargaRef = useRef<HTMLAnchorElement>(null);
  const shortfall = Boolean(quote && quote.needed > quote.available);
  const canConfirm =
    Boolean(quote) && !quotePending && !quoteError && !shortfall && !confirming;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !confirming) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, onClose, open]);

  useEffect(() => {
    if (!open || quotePending) return;
    const frame = window.requestAnimationFrame(() => {
      if (shortfall) recargaRef.current?.focus();
      else primaryRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, quotePending, shortfall]);

  if (!open || !intent) return null;

  const billedHint = quote ? alreadyBilledLine(quote.skipped) : null;
  const confirmLabel =
    intent.kind === "push"
      ? COPY.exportCostConfirmPush
      : COPY.exportCostConfirmExport;
  const pendingLabel =
    intent.kind === "push" ? COPY.exportCostSending : COPY.exportCostExporting;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/50"
        disabled={confirming}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={quotePending || confirming}
        className="relative w-full max-w-md rounded-t-lg border border-white/10 bg-podium-navy p-5 shadow-2xl sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-podium-yellow">
              <Coins className="h-3.5 w-3.5" />
              {COPY.exportCostEyebrow}
            </p>
            <h2 id={titleId} className="mt-1 text-base font-semibold">
              {intentTitle(intent)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-podium-muted hover:bg-white/5 hover:text-podium-white disabled:opacity-40"
            title="Fechar"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {quotePending ? (
            <p className="text-sm text-podium-muted">
              {COPY.exportCostCalculating}
            </p>
          ) : quoteError ? (
            <p className="text-sm text-podium-yellow">{quoteError}</p>
          ) : quote ? (
            <>
              <p className="text-sm text-podium-gray">
                {companiesLine(quote.companies)}
              </p>
              {quote.needed === 0 ? (
                <p className="text-lg font-semibold text-podium-white">
                  {COPY.exportCostNothing}
                </p>
              ) : (
                <p
                  className={cn(
                    "text-lg font-semibold",
                    shortfall ? "text-podium-yellow" : "text-podium-white",
                  )}
                >
                  {COPY.exportCostDebit.replace(
                    "{credits}",
                    creditsPhrase(quote.needed),
                  )}
                </p>
              )}
              {quote.chargeable > 0 ? (
                <p className="text-sm tabular-nums text-podium-muted">
                  {detailLine(quote.chargeable, quote.unitCost)}
                </p>
              ) : null}
              {billedHint ? (
                <p className="text-sm text-podium-muted">{billedHint}</p>
              ) : null}
              <p className="text-sm tabular-nums text-podium-gray">
                {COPY.exportCostBalance.replace(
                  "{credits}",
                  creditsPhrase(quote.available),
                )}
              </p>
            </>
          ) : null}
          {actionError ? (
            <p className="text-sm text-podium-yellow">{actionError}</p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={confirming}
            onClick={onClose}
          >
            {COPY.exportCostCancel}
          </Button>
          {shortfall ? (
            <Link
              ref={recargaRef}
              href={RECARGA_URL}
              className="inline-flex h-8 items-center justify-center rounded-md bg-podium-yellow px-3 text-xs font-medium text-podium-navy"
            >
              {COPY.exportCostRecarregar}
            </Link>
          ) : (
            <Button
              ref={primaryRef}
              type="button"
              variant="primary"
              size="md"
              disabled={!canConfirm}
              onClick={onConfirm}
            >
              {confirming ? pendingLabel : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
