import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  highlight = false,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl transition duration-300",
        "hover:-translate-y-0.5 hover:border-white/15 motion-reduce:hover:translate-y-0",
        highlight && "border-podium-yellow/15 hover:border-podium-yellow/30",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
