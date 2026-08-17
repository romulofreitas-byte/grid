"use client";

import { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExportDownload({
  searchId,
  format,
  label,
  className,
  wrapperClassName,
}: {
  searchId: string;
  format: "xlsx" | "csv" | "pdf";
  label: string;
  className?: string;
  wrapperClassName?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [needed, setNeeded] = useState<number | null>(null);

  async function run() {
    setError(null);
    const res = await fetch(`/api/export/${searchId}?format=${format}`);
    if (res.status === 402) {
      const json = (await res.json()) as { needed?: number; available?: number };
      setNeeded(json.needed ?? null);
      setError(
        `Faltam créditos (${json.available ?? 0} disponíveis). Recarregue ou mude de plano.`,
      );
      return;
    }
    if (!res.ok) {
      setError("Não foi possível exportar");
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
      <button
        type="button"
        onClick={() => void run()}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow",
          className,
        )}
      >
        <Download className="h-3.5 w-3.5" />
        {label}
      </button>
      {error ? (
        <span className="max-w-xs text-right text-[11px] text-podium-yellow">
          {error}{" "}
          <Link href="/planos" className="font-bold underline">
            Ver planos
          </Link>
          {needed != null ? ` · ${needed} créditos` : null}
        </span>
      ) : null}
    </span>
  );
}
