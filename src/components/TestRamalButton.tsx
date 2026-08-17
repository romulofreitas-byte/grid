"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { testCallDestination } from "@/lib/integrations/call-target";
import type { IntegrationConnectionPublic } from "@/lib/integrations/records";

export function TestRamalButton({
  connection,
}: {
  connection: IntegrationConnectionPublic;
}) {
  const dest = testCallDestination(connection);
  const [done, setDone] = useState(false);
  const test = useMutation({
    mutationFn: async () => {
      if (!dest.ok) throw new Error(dest.error);
      const res = await fetch("/api/integrations/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: connection.id,
          test: true,
          to: dest.to,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível ligar");
    },
    onSuccess: () => setDone(true),
  });

  if (connection.kind === "crm") return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={!dest.ok || test.isPending}
        onClick={() => test.mutate()}
        title={dest.ok ? "Ligar para o meu ramal" : dest.error}
        className="inline-flex items-center gap-2 rounded-xl border border-podium-yellow/40 px-3 py-2 text-xs font-bold text-podium-yellow disabled:opacity-40"
      >
        <Phone className="h-3.5 w-3.5" />
        {test.isPending ? "Ligando…" : done ? "Ramal chamado" : "Ligar para o meu ramal"}
      </button>
      {test.error ? (
        <p className="text-[11px] text-red-400">{test.error.message}</p>
      ) : null}
    </div>
  );
}
