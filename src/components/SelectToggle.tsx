"use client";

import { Check } from "lucide-react";
import { StartingLights } from "@/components/StartingLights";
import { buttonClassName } from "@/components/ui/Button";
import { useHoldLights } from "@/hooks/usePodiumWait";
import { cn } from "@/lib/utils";

export function SelectToggle({
  pressed,
  disabled,
  onToggle,
  idleLabel,
  pressedLabel,
  ariaLabel,
  variant = "button",
  className,
}: {
  pressed: boolean;
  disabled?: boolean;
  onToggle: () => void;
  idleLabel: string;
  pressedLabel: string;
  ariaLabel?: string;
  variant?: "button" | "text";
  className?: string;
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
        className,
      )}
    >
      {variant === "button" && pressed ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      ) : null}
      {label}
    </button>
  );
}

export function QualifyPendingButton({ ariaLabel }: { ariaLabel: string }) {
  const { litCount } = useHoldLights(true, true);

  return (
    <button
      type="button"
      disabled
      aria-busy
      aria-label={ariaLabel}
      className={buttonClassName({
        variant: "secondary",
        size: "sm",
        className: "min-w-[5.25rem] pointer-events-none disabled:opacity-100",
      })}
    >
      <StartingLights size="micro" phase="hold" litCount={litCount} />
    </button>
  );
}
