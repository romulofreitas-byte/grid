"use client";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/pilot-profile";
import type { Profile } from "@/lib/types";

export function PilotAvatar({
  profile,
  size = "md",
  className,
}: {
  profile: Pick<Profile, "foto_url" | "como_chama" | "nome">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-24 w-24 text-2xl" : "h-14 w-14 text-sm";
  if (profile.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.foto_url}
        alt=""
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-podium-yellow/40",
          dim,
          className,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-podium-yellow/15 font-extrabold text-podium-yellow ring-2 ring-podium-yellow/20",
        dim,
        className,
      )}
    >
      {initials(profile)}
    </span>
  );
}
