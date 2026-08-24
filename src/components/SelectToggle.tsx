import { Check } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
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
        variant === "text" &&
          "inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-podium-yellow transition hover:underline",
        variant === "button" &&
          buttonClassName({
            variant: pressed ? "primary" : "secondary",
            size: "sm",
          }),
      )}
    >
      {variant === "button" && pressed ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      ) : null}
      {label}
    </button>
  );
}
