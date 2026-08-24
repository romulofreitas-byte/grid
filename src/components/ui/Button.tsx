import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANT = {
  primary:
    "bg-gradient-to-b from-[#ffc933] to-podium-yellow text-podium-navy shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_2px_rgba(0,0,0,0.25)] hover:from-[#ffd24a] hover:to-[#f5b301] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_4px_12px_rgba(245,179,1,0.28)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.3)] disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_2px_rgba(0,0,0,0.25)] motion-reduce:hover:translate-y-0",
  secondary:
    "border border-white/15 bg-white/[0.04] text-podium-gray shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-podium-yellow/35 hover:bg-white/[0.08] hover:text-podium-white hover:shadow-[0_0_0_1px_rgba(245,179,1,0.08)] hover:-translate-y-px active:translate-y-0 active:bg-white/[0.06] disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0",
  ghost:
    "text-podium-muted hover:bg-white/5 hover:text-podium-gray active:bg-white/[0.07] disabled:opacity-40",
  danger:
    "border border-podium-alert/40 bg-podium-alert/10 text-podium-alert shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-podium-alert/55 hover:bg-podium-alert/20 hover:-translate-y-px active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0",
  accent:
    "border border-podium-yellow/40 bg-podium-yellow/10 text-podium-yellow shadow-[inset_0_1px_0_rgba(245,179,1,0.12)] hover:border-podium-yellow/60 hover:bg-podium-yellow/18 hover:shadow-[0_0_0_1px_rgba(245,179,1,0.12)] hover:-translate-y-px active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0",
} as const;

const SIZE = {
  sm: "h-8 rounded-lg px-2.5 text-xs font-semibold",
  md: "h-9 rounded-lg px-3.5 text-sm font-semibold",
  lg: "h-10 rounded-lg px-4 text-sm font-semibold",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-podium-yellow/40 active:duration-75";

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
