import type { ReactNode } from "react";
import { PilotAvatar } from "@/components/PilotAvatar";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PilotGlassChip({
  profile,
  shortName,
  fullName,
  eyebrow = "Piloto",
  chevron,
  className,
  omitTitle = false,
}: {
  profile: Pick<Profile, "foto_url" | "como_chama" | "nome">;
  shortName: string;
  fullName: string;
  eyebrow?: string;
  chevron?: ReactNode;
  className?: string;
  omitTitle?: boolean;
}) {
  return (
    <span
      title={omitTitle ? undefined : fullName}
      className={cn(
        "inline-flex max-w-full items-center gap-2.5 rounded-xl border py-1.5 pl-1.5",
        chevron ? "pr-2" : "pr-3",
        "border-white/[0.10] bg-podium-panel",
        className,
      )}
    >
      <PilotAvatar
        profile={profile}
        size="header"
        shape="squircle"
      />
      <span className="flex min-w-0 flex-col items-start justify-center leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted">
          {eyebrow}
        </span>
        <span className="max-w-[8rem] truncate text-xs tabular-nums text-podium-white">
          {shortName}
        </span>
      </span>
      {chevron ? <span className="shrink-0">{chevron}</span> : null}
    </span>
  );
}
