"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { SaveListDialog } from "@/components/SaveListDialog";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";

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
      <Button
        type="button"
        variant="primary"
        size={cockpit ? "lg" : "sm"}
        onClick={() => {
          setName(nome);
          setError(null);
          setOpen(true);
        }}
        className={cockpit ? "gap-2" : undefined}
      >
        <BookmarkPlus className={cockpit ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {COPY.salvarLista}
      </Button>
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
