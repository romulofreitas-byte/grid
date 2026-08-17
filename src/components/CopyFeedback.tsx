"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function CopyFeedback({
  value,
  label,
  actionLabel = "Copiar código",
  multiline = false,
  className,
}: {
  value: string;
  label: string;
  actionLabel?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [value]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      return;
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-sm text-podium-white outline-none";

  return (
    <div className={className}>
      <label className="block text-xs text-podium-muted">
        {label}
        {multiline ? (
          <textarea
            readOnly
            value={value}
            className={cn(fieldClass, "h-24 py-2 text-xs")}
          />
        ) : (
          <input readOnly value={value} className={fieldClass} />
        )}
      </label>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-podium-yellow/40 px-4 py-2 text-sm font-bold text-podium-yellow"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado" : actionLabel}
      </button>
    </div>
  );
}
