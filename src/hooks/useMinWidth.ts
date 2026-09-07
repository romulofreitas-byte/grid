"use client";

import { useEffect, useState } from "react";

/** Desktop-first: SSR and first paint assume `min-width` matches. */
export function useMinWidth(px: number): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia(`(min-width: ${px}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [px]);

  return matches;
}

/** Mobile-first: SSR assumes a phone so Grid/CRM don't flash desktop chrome. */
export function useMdUp(): boolean {
  return useMinWidthMobileFirst(768);
}

export function useLgUp(): boolean {
  return useMinWidthMobileFirst(1024);
}

function useMinWidthMobileFirst(px: number): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [px]);

  return matches;
}
