"use client";

import { useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { uploadProfilePhoto } from "@/components/PhotoPicker";
import { COPY } from "@/lib/copy";
import { initials } from "@/lib/pilot-profile";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SetupIdentityCard({
  profile,
  echo,
  nameOn,
  marketOn,
  cargoOn,
  onUploaded,
}: {
  profile: Pick<Profile, "foto_url" | "como_chama" | "nome">;
  echo: string;
  nameOn: boolean;
  marketOn: boolean;
  cargoOn: boolean;
  onUploaded: (profile: Profile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoOn = Boolean(profile.foto_url);
  const badges = [
    { id: "nome", label: COPY.setupBadgeName, on: nameOn },
    { id: "mercado", label: COPY.setupBadgeMarket, on: marketOn },
    { id: "cargo", label: COPY.setupBadgeCargo, on: cargoOn },
    { id: "foto", label: COPY.setupBadgePhoto, on: photoOn },
  ] as const;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadProfilePhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a foto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
      <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight md:text-5xl">
        {COPY.setupStepPhoto}
      </h1>
      {echo ? (
        <p className="mt-3 text-sm font-medium text-podium-yellow md:text-base">{echo}</p>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Enviar foto"
        className={cn(
          "group relative mt-8 w-40 overflow-hidden rounded-2xl border transition md:mt-10 md:w-52",
          "aspect-[3/4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/60",
          photoOn
            ? "border-podium-yellow/50 shadow-[0_0_0_1px_rgba(250,204,21,0.15)]"
            : "border-dashed border-white/25 bg-white/[0.04] hover:border-podium-yellow/50 hover:bg-white/[0.07]",
          busy && "opacity-70",
        )}
      >
        {profile.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.foto_url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-3">
            <span className="font-[family-name:var(--font-sora)] text-4xl font-extrabold text-podium-yellow md:text-5xl">
              {initials(profile)}
            </span>
            <span className="text-[11px] font-medium text-podium-muted">
              {busy ? "Enviando…" : "Toque para colocar a foto"}
            </span>
          </span>
        )}
        <span className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-podium-yellow text-podium-navy shadow-lg">
          <Camera className="h-4 w-4" />
        </span>
      </button>

      <ul className="mt-8 flex flex-wrap items-center justify-center gap-2 md:mt-10">
        {badges.map((badge) => (
          <li
            key={badge.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition",
              badge.on
                ? "border-podium-yellow/40 bg-podium-yellow/15 text-podium-yellow"
                : "border-white/10 bg-white/[0.03] text-podium-muted",
            )}
          >
            {badge.on ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
            {badge.label}
          </li>
        ))}
      </ul>

      {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}

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
