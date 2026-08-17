"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { SaveListDialog } from "@/components/SaveListDialog";
import { COPY } from "@/lib/copy";

export function SaveListButton({
  searchId,
  nome,
}: {
  searchId: string;
  nome: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(nome);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/search/${searchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: trimmed, saved: true }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar");
      setPending(false);
      setOpen(false);
      router.refresh();
    } catch {
      setPending(false);
      setError("Não foi possível salvar. Tente de novo.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(nome);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-xl bg-podium-yellow px-3 py-2 text-xs font-extrabold text-podium-navy hover:brightness-110"
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        {COPY.salvarLista}
      </button>
      <SaveListDialog
        open={open}
        saved={false}
        name={name}
        pending={pending}
        error={error}
        onClose={() => {
          if (pending) return;
          setOpen(false);
          setName(nome);
          setError(null);
        }}
        onNameChange={setName}
        onSubmit={onSubmit}
      />
    </>
  );
}
