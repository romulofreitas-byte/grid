import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold";

export function FichaChip<T extends ElementType = "button">({
  as,
  active = false,
  disabled,
  className,
  children,
  ...props
}: {
  as?: T;
  active?: boolean;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">) {
  const Comp = (as ?? "button") as ElementType;
  return (
    <Comp
      disabled={Comp === "button" ? disabled : undefined}
      className={cn(
        CHIP,
        active
          ? "border-podium-yellow/40 bg-podium-yellow/10 text-podium-yellow"
          : "border-white/15 text-podium-gray hover:border-podium-yellow/30 hover:text-podium-yellow",
        disabled && "cursor-not-allowed opacity-40 hover:border-white/15 hover:text-podium-gray",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
