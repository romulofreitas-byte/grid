"use client";

import { Phone } from "lucide-react";
import { FichaChip } from "@/components/FichaChip";
import { GlassCard } from "@/components/GlassCard";
import type { LeadStatus } from "@/lib/types";

const STATUSES: Array<{ id: LeadStatus; label: string }> = [
  { id: "novo", label: "Novo" },
  { id: "ligando", label: "Ligando" },
  { id: "reuniao", label: "Reunião" },
  { id: "descartado", label: "Descartado" },
];

export function LeadStatusStrip({
  status,
  notas,
  recordPending,
  onStatus,
  onRecordCall,
  onNotasBlur,
}: {
  status: LeadStatus;
  notas: string | null;
  recordPending: boolean;
  onStatus: (status: LeadStatus) => void;
  onRecordCall: () => void;
  onNotasBlur: (notas: string) => void;
}) {
  return (
    <GlassCard className="space-y-3 p-4 hover:translate-y-0">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <FichaChip
            key={s.id}
            type="button"
            active={status === s.id}
            onClick={() => onStatus(s.id)}
          >
            {s.label}
          </FichaChip>
        ))}
        <FichaChip
          type="button"
          disabled={recordPending}
          onClick={onRecordCall}
          className="ml-auto"
        >
          <Phone className="h-3.5 w-3.5" />
          {recordPending ? "Registrando…" : "Registrei"}
        </FichaChip>
      </div>
      <textarea
        defaultValue={notas ?? ""}
        onBlur={(e) => onNotasBlur(e.target.value)}
        rows={2}
        placeholder="O que rolou na ligação"
        className="w-full resize-none rounded-xl border border-white/10 bg-podium-panel px-3 py-2 text-sm outline-none focus:border-podium-yellow/40"
      />
    </GlassCard>
  );
}
