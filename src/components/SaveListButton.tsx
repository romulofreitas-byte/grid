"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { SaveListDialog } from "@/components/SaveListDialog";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function SaveListButton({
  searchId,
  nome,
  variant = "compact",
}: {
  searchId: string;
  nome: string;
  variant?: "compact" | "cockpit";
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

  const cockpit = variant === "cockpit";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(nome);
          setError(null);
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center font-extrabold text-podium-navy hover:brightness-110",
          cockpit
            ? "justify-center gap-3 rounded-xl bg-podium-yellow px-8 py-4 text-base"
            : "gap-1.5 rounded-xl bg-podium-yellow px-3 py-2 text-xs",
        )}
      >
        <BookmarkPlus className={cockpit ? "h-5 w-5" : "h-3.5 w-3.5"} />
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
