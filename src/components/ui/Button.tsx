import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANT = {
  primary:
    "bg-gradient-to-b from-[#ffc933] to-podium-yellow text-podium-navy shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_2px_rgba(0,0,0,0.25)] hover:from-[#ffd24a] hover:to-[#f5b301] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_2px_8px_rgba(245,179,1,0.22)] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.3)] disabled:opacity-40",
  secondary:
    "border border-white/15 bg-white/[0.04] text-podium-gray shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-podium-yellow/35 hover:bg-white/[0.08] hover:text-podium-white hover:shadow-[0_0_0_1px_rgba(245,179,1,0.08)] active:bg-white/[0.06] disabled:opacity-40",
  ghost:
    "text-podium-muted hover:bg-white/5 hover:text-podium-gray active:bg-white/[0.07] disabled:opacity-40",
  danger:
    "border border-podium-alert/40 bg-podium-alert/10 text-podium-alert shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-podium-alert/55 hover:bg-podium-alert/20 disabled:opacity-40",
  accent:
    "border border-podium-yellow/40 bg-podium-yellow/10 text-podium-yellow shadow-[inset_0_1px_0_rgba(245,179,1,0.12)] hover:border-podium-yellow/60 hover:bg-podium-yellow/18 hover:shadow-[0_0_0_1px_rgba(245,179,1,0.12)] disabled:opacity-40",
} as const;

const SIZE = {
  sm: "h-7 rounded-md px-2 text-[11px] font-medium",
  md: "h-8 rounded-md px-3 text-xs font-medium",
  lg: "h-9 rounded-md px-3.5 text-xs font-medium",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40 active:duration-75";

export function buttonClassName({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(BASE, VARIANT[variant], SIZE[size], className);
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  }
>(function Button(
  { className, variant = "secondary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
});
