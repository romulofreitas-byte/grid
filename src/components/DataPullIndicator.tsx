"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { StartingLights } from "@/components/StartingLights";
import {
  type DataPullLongOp,
  useDataPullState,
} from "@/hooks/useDataPullState";

const LONG_OP_LABEL: Record<Exclude<DataPullLongOp, null>, string> = {
  grid: "Montando grid…",
  audit: "Qualificando…",
};

export function TelemetryBar() {
  const { busy } = useDataPullState();

  return (
    <AnimatePresence>
      {busy ? (
        <motion.div
          key="telemetry-bar"
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="telemetry-bar" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function LongOpChip() {
  const { longOp } = useDataPullState();
  const reduce = useReducedMotion();
  const [litCount, setLitCount] = useState(reduce ? 5 : 1);

  useEffect(() => {
    if (!longOp || reduce) {
      setLitCount(5);
      return;
    }
    setLitCount(1);
    const id = window.setInterval(() => {
      setLitCount((n) => (n >= 5 ? 1 : n + 1));
    }, 280);
    return () => window.clearInterval(id);
  }, [longOp, reduce]);

  return (
    <AnimatePresence>
      {longOp ? (
        <motion.div
          key={longOp}
          role="status"
          aria-live="polite"
          className="inline-flex max-w-[min(100%,14rem)] items-center gap-2 rounded-xl border border-white/10 bg-podium-navy/80 px-2.5 py-1.5 backdrop-blur-xl md:max-w-none md:px-3"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          <StartingLights
            compact
            phase="hold"
            litCount={litCount}
          />
          <span className="truncate text-[10px] font-bold uppercase tracking-wide text-podium-yellow md:text-[11px]">
            {LONG_OP_LABEL[longOp]}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
