"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PilotGlassChip } from "@/components/PilotGlassChip";
import { useFocusMode } from "@/components/FocusModeProvider";
import { COPY } from "@/lib/copy";
import {
  FOCUS_SPRINT_MS,
  focusSprintRemainingMs,
  formatFocusSprintClock,
} from "@/lib/focus-mode";
import { headerGivenName } from "@/lib/pilot-profile";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FocusBadge() {
  const { on, startedAt, exit } = useFocusMode();
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return null;
      return (await res.json()) as Profile;
    },
    enabled: on,
  });

  useEffect(() => {
    if (!on || startedAt == null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [on, startedAt]);

  const remaining =
    startedAt == null
      ? FOCUS_SPRINT_MS
      : focusSprintRemainingMs(startedAt, now);
  const done = remaining <= 0;
  const clock = done
    ? COPY.focusSprintDone
    : formatFocusSprintClock(remaining);
  const p = query.data;
  const fullName = p ? headerGivenName(p) : COPY.focusBadgeEyebrow;

  return (
    <AnimatePresence>
      {on ? (
        <motion.button
          key="focus-badge"
          type="button"
          title={COPY.focusExit}
          aria-label={`${COPY.focusExit} · ${clock}`}
          onClick={exit}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{
            duration: reduce ? 0 : 0.28,
            delay: reduce ? 0 : 0.15,
            ease: "easeOut",
          }}
          className={cn(
            "fixed right-4 bottom-4 z-50 hidden max-w-full rounded-xl outline-none md:inline-flex",
            "focus-visible:ring-2 focus-visible:ring-podium-yellow ring-offset-2 ring-offset-podium-navy",
          )}
        >
          {p ? (
            <PilotGlassChip
              profile={p}
              shortName={clock}
              fullName={fullName}
              eyebrow={COPY.focusBadgeEyebrow}
              omitTitle
              chevron={
                <Minimize2 className="h-3.5 w-3.5 shrink-0 text-podium-yellow" />
              }
              className="border-podium-yellow/40"
            />
          ) : (
            <span className="inline-flex items-center gap-2.5 rounded-xl border border-podium-yellow/40 bg-podium-panel py-1.5 pr-3 pl-3">
              <span className="flex min-w-0 flex-col items-start justify-center leading-tight">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-podium-muted">
                  {COPY.focusBadgeEyebrow}
                </span>
                <span className="text-xs tabular-nums text-podium-white">
                  {clock}
                </span>
              </span>
            </span>
          )}
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
