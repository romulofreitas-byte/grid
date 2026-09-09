"use client";

import { animate, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ANIMATED_NUMBER_DURATION_S,
  animatedNumberTweenFrom,
  formatAnimatedNumber,
  type AnimatedNumberFormat,
} from "@/components/animated-number";
import { cn } from "@/lib/utils";

export function useMountFill(): boolean {
  const reduce = useReducedMotion();
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (reduce) {
      setFilled(true);
      return;
    }
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, [reduce]);

  return Boolean(reduce) || filled;
}

export function MountFade({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const filled = useMountFill();
  return (
    <div
      className={cn(
        !reduce && "transition-opacity duration-700 ease-out",
        filled ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: AnimatedNumberFormat;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const previous = useRef<number | null>(null);
  const [shown, setShown] = useState(() =>
    formatAnimatedNumber(reduce ? value : 0, format),
  );

  useEffect(() => {
    const from = animatedNumberTweenFrom(previous.current, value, Boolean(reduce));
    if (from === value) {
      previous.current = value;
      setShown(formatAnimatedNumber(value, format));
      return;
    }
    const controls = animate(from, value, {
      duration: ANIMATED_NUMBER_DURATION_S,
      ease: "easeOut",
      onUpdate(latest) {
        previous.current = latest;
        setShown(formatAnimatedNumber(latest, format));
      },
    });
    return () => controls.stop();
  }, [value, format, reduce]);

  return <span className={cn("tabular-nums", className)}>{shown}</span>;
}
