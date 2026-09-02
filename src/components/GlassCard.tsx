import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  highlight = false,
  hover = true,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  highlight?: boolean;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl transition duration-200",
        hover && "hover:border-white/15",
        highlight && "border-podium-yellow/15",
        highlight && hover && "hover:border-podium-yellow/30",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
