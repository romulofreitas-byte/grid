"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useFocusMode } from "@/components/FocusModeProvider";
import { FocusSwitch } from "@/components/FocusSwitch";
import { COPY } from "@/lib/copy";
import {
  FOCUS_SPRINT_MS,
  focusSprintRemainingMs,
  formatFocusSprintClock,
} from "@/lib/focus-mode";
import { SHELL_FOCUS_BADGE_BOTTOM, SHELL_Z } from "@/lib/shell-chrome";
import { cn } from "@/lib/utils";

export function FocusBadge() {
  const { on, startedAt, exit } = useFocusMode();
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());

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

  return (
    <AnimatePresence>
      {on ? (
        <motion.div
          key="focus-badge"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{
            duration: reduce ? 0 : 0.28,
            delay: reduce ? 0 : 0.15,
            ease: "easeOut",
          }}
          className={cn(
            "fixed right-4",
            SHELL_FOCUS_BADGE_BOTTOM,
            SHELL_Z.toast,
          )}
        >
          <FocusSwitch
            on
            onToggle={exit}
            className="rounded-xl border border-white/10 bg-podium-navy/90 backdrop-blur-xl"
          >
            <span className="text-xs tabular-nums text-podium-white">{clock}</span>
          </FocusSwitch>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
