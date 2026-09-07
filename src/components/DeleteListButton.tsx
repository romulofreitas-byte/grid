"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { COPY } from "@/lib/copy";

export function DeleteListButton({
  searchId,
  nome,
}: {
  searchId: string;
  nome: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeEntrada, setRemoveEntrada] = useState(false);
  const [entradaCount, setEntradaCount] = useState<number | null>(null);

  async function onDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/search/${searchId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeEntrada }),
      });
      if (!res.ok) throw new Error("Não foi possível excluir");
      router.refresh();
    } catch {
      setPending(false);
      setError("Não foi possível excluir. Tente de novo.");
    }
  }

  function startConfirm() {
    setConfirming(true);
    setRemoveEntrada(false);
    setEntradaCount(null);
    void fetch(`/api/search/${searchId}/crm-entrada`)
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { entradaCount?: number };
        if (typeof json.entradaCount === "number") {
          setEntradaCount(json.entradaCount);
        }
      })
      .catch(() => undefined);
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p className="max-w-[16rem] text-right text-xs text-podium-muted">
          {COPY.crmDeleteListWarn.replace("{nome}", nome)}
        </p>
        {entradaCount != null && entradaCount > 0 ? (
          <label className="flex max-w-[16rem] items-start gap-2 text-right text-xs text-podium-gray">
            <span>
              {COPY.crmDeleteListEntrada.replace("{n}", String(entradaCount))}
              <span className="mt-0.5 block text-[10px] text-podium-muted">
                {COPY.crmDeleteListEntradaHint}
              </span>
            </span>
            <input
              type="checkbox"
              checked={removeEntrada}
              onChange={(event) => setRemoveEntrada(event.target.checked)}
              className="mt-0.5"
            />
          </label>
        ) : (
          <p className="max-w-[16rem] text-right text-[10px] text-podium-muted">
            {COPY.crmDeleteListEntradaHint}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-white/30 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onDelete()}
            className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/25 disabled:opacity-40"
          >
            {pending ? "Excluindo…" : COPY.crmDeleteListConfirm}
          </button>
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startConfirm}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-red-400/40 hover:text-red-400"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Excluir
    </button>
  );
}
