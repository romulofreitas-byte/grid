import type { ReactNode } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

export function OpenableCard({
  href,
  label,
  children,
  actions,
  className,
}: {
  href: string;
  label: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <GlassCard
      className={cn(
        "relative flex flex-wrap items-center justify-between gap-3 p-4",
        className,
      )}
    >
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={label}
      />
      <div className="pointer-events-none relative z-[1] min-w-0 flex-1">
        {children}
      </div>
      {actions ? (
        <div className="relative z-[1] flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </GlassCard>
  );
}
