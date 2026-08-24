"use client";

import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
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
  callAction,
}: {
  status: LeadStatus;
  notas: string | null;
  recordPending: boolean;
  onStatus: (status: LeadStatus) => void;
  onRecordCall: () => void;
  onNotasBlur: (notas: string) => void;
  callAction?: ReactNode;
}) {
  return (
    <GlassCard className="space-y-3 border-white/10 bg-white/[0.03] p-4 hover:translate-y-0">
      {callAction ? <div>{callAction}</div> : null}
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <ChoiceTile
            key={s.id}
            density="chip"
            selected={status === s.id}
            onClick={() => onStatus(s.id)}
            className="min-w-0 flex-none"
          >
            {s.label}
          </ChoiceTile>
        ))}
        <Button
          size="sm"
          variant="ghost"
          disabled={recordPending}
          onClick={onRecordCall}
          className="ml-auto gap-1.5"
        >
          <Phone className="h-3.5 w-3.5" />
          {recordPending ? "Registrando…" : "Registrei"}
        </Button>
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
