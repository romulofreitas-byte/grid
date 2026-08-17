"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

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

  async function onDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/search/${searchId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Não foi possível excluir");
      router.refresh();
    } catch {
      setPending(false);
      setError("Não foi possível excluir. Tente de novo.");
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p className="max-w-[14rem] text-right text-xs text-podium-muted">
          Excluir “{nome}”? Isso não dá para desfazer.
        </p>
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
            onClick={onDelete}
            className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/25 disabled:opacity-40"
          >
            {pending ? "Excluindo…" : "Excluir"}
          </button>
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-podium-gray hover:border-red-400/40 hover:text-red-400"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Excluir
    </button>
  );
}
