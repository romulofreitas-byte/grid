"use client";

import type { LightsPhase } from "@/components/StartingLights";
import { useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function useHoldLights(active: boolean, cycle: boolean) {
  const reduce = useReducedMotion();
  const [litCount, setLitCount] = useState(5);

  useEffect(() => {
    if (!active || reduce || !cycle) {
      setLitCount(5);
      return;
    }
    setLitCount(1);
    const id = window.setInterval(() => {
      setLitCount((n) => (n >= 5 ? 1 : n + 1));
    }, 280);
    return () => window.clearInterval(id);
  }, [active, reduce, cycle]);

  return { reduce: Boolean(reduce), litCount };
}

export function usePodiumWait(cycle: boolean) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [phase, setPhase] = useState<LightsPhase>("hold");
  const [litCount, setLitCount] = useState(5);
  const going = useRef(false);

  useEffect(() => {
    if (phase === "go") {
      setLitCount(5);
      return;
    }
    if (reduce || !cycle) {
      setLitCount(5);
      return;
    }
    setLitCount(1);
    const id = window.setInterval(() => {
      setLitCount((n) => (n >= 5 ? 1 : n + 1));
    }, 280);
    return () => window.clearInterval(id);
  }, [reduce, cycle, phase]);

  const goToSuccess = useCallback(
    (orderId: string) => {
      if (going.current) return;
      going.current = true;
      if (reduce) {
        router.push(`/pagar/sucesso?order=${orderId}`);
        return;
      }
      setPhase("go");
      setLitCount(5);
      window.setTimeout(() => {
        router.push(`/pagar/sucesso?order=${orderId}`);
      }, 300);
    },
    [reduce, router],
  );

  return { reduce: Boolean(reduce), phase, litCount, goToSuccess };
}
