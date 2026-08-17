"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { PilotAvatar } from "@/components/PilotAvatar";
import type { Profile } from "@/lib/types";

async function fileToSquareJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("invalid image"));
      el.src = url;
    });
    const size = Math.min(img.width, img.height);
    const sx = (img.width - size) / 2;
    const sy = (img.height - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoPicker({
  profile,
  onUploaded,
}: {
  profile: Pick<Profile, "foto_url" | "como_chama" | "nome">;
  onUploaded: (profile: Profile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToSquareJpeg(file);
      const res = await fetch("/api/profile/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const json = (await res.json()) as Profile & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar a foto");
      onUploaded(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a foto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative shrink-0"
      >
        <PilotAvatar profile={profile} size="lg" />
        <span className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-podium-yellow text-podium-navy">
          <Camera className="h-4 w-4" />
        </span>
      </button>
      <div>
        <p className="text-sm font-bold">Foto do capacete</p>
        <p className="mt-1 text-xs text-podium-muted">
          {busy ? "Enviando…" : "Toque para recortar em quadrado. JPEG, PNG ou WebP."}
        </p>
        {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
