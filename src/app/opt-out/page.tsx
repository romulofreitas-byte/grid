"use client";

import { GlassCard } from "@/components/GlassCard";
import { PublicPage } from "@/components/PublicPage";
import { SectionTitle } from "@/components/SectionTitle";
import { useState } from "react";

export default function OptOutPage() {
  const [documento, setDocumento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/opt-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documento, motivo }),
    });
    setDone(true);
  }

  return (
    <PublicPage className="max-w-lg">
      <SectionTitle className="mt-8">Canal de oposição (opt-out)</SectionTitle>
      <GlassCard className="mt-6 p-6">
        {done ? (
          <p className="text-sm text-podium-gray">
            Solicitação registrada. Processamos em até 15 dias.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm text-podium-gray">
              CNPJ ou nome
              <input
                required
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none"
              />
            </label>
            <label className="block text-sm text-podium-gray">
              Motivo (opcional)
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 outline-none"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-podium-yellow py-3 text-sm font-bold text-podium-navy"
            >
              Solicitar remoção
            </button>
          </form>
        )}
      </GlassCard>
    </PublicPage>
  );
}
