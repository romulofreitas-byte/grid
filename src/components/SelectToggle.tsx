import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function SelectToggle({
  pressed,
  disabled,
  onToggle,
  idleLabel,
  pressedLabel,
  ariaLabel,
  variant = "button",
}: {
  pressed: boolean;
  disabled?: boolean;
  onToggle: () => void;
  idleLabel: string;
  pressedLabel: string;
  ariaLabel?: string;
  variant?: "button" | "text";
}) {
  if (disabled) return null;

  const label = pressed ? pressedLabel : idleLabel;

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel ?? label}
      onClick={onToggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 font-extrabold transition",
        variant === "text" &&
          "normal-case tracking-normal text-xs text-podium-yellow hover:underline",
        variant === "button" && "h-9 rounded-xl px-2.5 text-xs",
        variant === "button" &&
          (pressed
            ? "bg-podium-yellow text-podium-navy"
            : "border border-white/15 text-podium-gray hover:border-podium-yellow/40 hover:text-podium-yellow"),
      )}
    >
      {variant === "button" && pressed ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      ) : null}
      {label}
    </button>
  );
}
