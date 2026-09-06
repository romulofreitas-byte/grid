"use client";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/pilot-profile";
import type { Profile } from "@/lib/types";

export function PilotAvatar({
  profile,
  size = "md",
  shape = "circle",
  tone = "dark",
  className,
}: {
  profile: Pick<Profile, "foto_url" | "como_chama" | "nome">;
  size?: "sm" | "md" | "lg" | "header";
  shape?: "circle" | "squircle";
  tone?: "dark" | "light";
  className?: string;
}) {
  const dim =
    size === "header" || size === "sm"
      ? "h-8 w-8 text-[10px]"
      : size === "lg"
        ? "h-24 w-24 text-2xl"
        : "h-14 w-14 text-sm";
  const squircle = shape === "squircle";
  const radius = squircle ? "rounded-lg" : "rounded-full";
  const photoRing = squircle
    ? tone === "light"
      ? "ring-1 ring-inset ring-zinc-300/70"
      : "ring-1 ring-inset ring-white/20"
    : "ring-2 ring-podium-yellow/40";
  const fallbackRing = squircle
    ? tone === "light"
      ? "ring-1 ring-inset ring-zinc-300/70"
      : "ring-1 ring-inset ring-white/20"
    : "ring-2 ring-podium-yellow/20";
  const fallbackFill = squircle
    ? tone === "light"
      ? "bg-zinc-900/[0.06] text-zinc-700"
      : "bg-white/10 text-podium-white"
    : "bg-podium-yellow/15 text-podium-yellow";

  if (profile.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.foto_url}
        alt=""
        className={cn("shrink-0 object-cover", radius, photoRing, dim, className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-extrabold",
        radius,
        fallbackFill,
        fallbackRing,
        dim,
        className,
      )}
    >
      {initials(profile)}
    </span>
  );
}
