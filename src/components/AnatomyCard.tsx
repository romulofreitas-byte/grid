"use client";

import { Copy, Pencil } from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import {
  ctaGlance,
  helloGlance,
  type AnatomyBeats,
} from "@/lib/golden-minute-script";
import { DEFAULT_MEETING_MINUTES } from "@/lib/pilot-profile";
import { cn } from "@/lib/utils";

const GLANCE = ["Olá", "Pergunta", "Agenda"] as const;

export function AnatomyCard({
  beats,
  editing,
  onToggleEdit,
  onChangeBeat,
  onCopy,
  copied,
  volta,
  duracao = DEFAULT_MEETING_MINUTES,
}: {
  beats: AnatomyBeats;
  editing: boolean;
  onToggleEdit: () => void;
  onChangeBeat: (index: number, value: string) => void;
  onCopy: () => void;
  copied: boolean;
  volta?: string | null;
  duracao?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);

  function glance(index: number): string {
    if (index === 0) return helloGlance(beats[0]);
    if (index === 2) return ctaGlance(beats[2], duracao);
    return beats[1] || "—";
  }

  return (
    <GlassCard className="p-5 hover:translate-y-0" highlight>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-extrabold leading-tight">Anatomia</h2>
        {volta ? (
          <span className="shrink-0 rounded-full border border-podium-yellow/30 px-2.5 py-1 text-[11px] font-bold text-podium-yellow">
            {volta}
          </span>
        ) : null}
      </div>

      <ol className="mt-4 space-y-2">
        {GLANCE.map((label, i) => {
          const expanded = open === i;
          return (
            <li key={label}>
              {editing ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-yellow">
                    {i + 1} · {label}
                  </p>
                  <textarea
                    value={beats[i]}
                    onChange={(e) => onChangeBeat(i, e.target.value)}
                    rows={i === 1 ? 2 : 3}
                    className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-podium-panel px-3 py-2 text-sm leading-relaxed outline-none focus:border-podium-yellow/40"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen((cur) => (cur === i ? null : i))}
                  aria-expanded={expanded}
                  className={cn(
                    "w-full rounded-2xl border px-3 py-2.5 text-left transition",
                    expanded
                      ? "border-podium-yellow/40 bg-podium-yellow/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20",
                  )}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
                    {i + 1} · {label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-bold leading-snug text-podium-white",
                      i === 1 ? "text-sm" : "text-base",
                    )}
                  >
                    {glance(i)}
                  </p>
                  {expanded && beats[i] !== glance(i) ? (
                    <p className="mt-2 text-sm font-medium leading-relaxed text-podium-gray">
                      {beats[i]}
                    </p>
                  ) : null}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleEdit}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
        >
          <Pencil className="h-4 w-4" />
          {editing ? "Pronto" : "Editar"}
        </button>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </GlassCard>
  );
}
