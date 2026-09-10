"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StartingLights, type LightsPhase } from "@/components/StartingLights";
import { COPY } from "@/lib/copy";
import { SHELL_Z } from "@/lib/shell-chrome";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = 5200;
const REDUCE_DISMISS_MS = 8000;
const EASE = [0.16, 1, 0.3, 1] as const;

const FLAG_PIECES = [
  { left: "6%", delay: 0.04, rotate: -22, size: 18, drift: 8 },
  { left: "16%", delay: 0.14, rotate: 16, size: 12, drift: -10 },
  { left: "27%", delay: 0.08, rotate: -8, size: 14, drift: 6 },
  { left: "38%", delay: 0.2, rotate: 24, size: 10, drift: -14 },
  { left: "48%", delay: 0.1, rotate: -14, size: 16, drift: 4 },
  { left: "58%", delay: 0.18, rotate: 10, size: 12, drift: 12 },
  { left: "69%", delay: 0.06, rotate: -26, size: 14, drift: -6 },
  { left: "78%", delay: 0.16, rotate: 18, size: 11, drift: 10 },
  { left: "86%", delay: 0.12, rotate: -12, size: 15, drift: -8 },
  { left: "93%", delay: 0.22, rotate: 8, size: 10, drift: 5 },
] as const;

function FlagPiece({
  left,
  delay,
  rotate,
  size,
  drift,
}: (typeof FLAG_PIECES)[number]) {
  return (
    <motion.span
      className="pointer-events-none absolute top-8 rounded-[2px] shadow-sm"
      style={{
        left,
        width: size,
        height: size,
        background:
          "repeating-conic-gradient(var(--podium-navy) 0% 25%, var(--podium-yellow) 0% 50%) 0 0 / 8px 8px",
      }}
      initial={{ y: -24, opacity: 0, rotate: 0, x: 0 }}
      animate={{
        y: "72vh",
        opacity: [0, 1, 1, 0],
        rotate,
        x: drift,
      }}
      transition={{
        duration: 1.45,
        delay,
        ease: "easeIn",
      }}
    />
  );
}

export function CrmWinCelebration({
  companyName,
  onDone,
}: {
  companyName: string | null;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || !companyName) return null;

  return createPortal(
    <AnimatePresence>
      <WinOverlay
        key="crm-win"
        companyName={companyName}
        reduce={Boolean(reduce)}
        onDone={() => onDoneRef.current()}
      />
    </AnimatePresence>,
    document.body,
  );
}

function WinOverlay({
  companyName,
  reduce,
  onDone,
}: {
  companyName: string;
  reduce: boolean;
  onDone: () => void;
}) {
  const done = useRef(false);
  const [litCount, setLitCount] = useState(reduce ? 5 : 0);
  const [phase, setPhase] = useState<LightsPhase>(reduce ? "go" : "lighting");

  function finish() {
    if (done.current) return;
    done.current = true;
    onDone();
  }

  useEffect(() => {
    const auto = window.setTimeout(
      finish,
      reduce ? REDUCE_DISMISS_MS : AUTO_DISMISS_MS,
    );
    if (reduce) {
      return () => window.clearTimeout(auto);
    }
    const lights = [1, 2, 3, 4, 5].map((count) =>
      window.setTimeout(() => setLitCount(count), count * 70),
    );
    const go = window.setTimeout(() => {
      setLitCount(5);
      setPhase("go");
    }, 480);
    return () => {
      window.clearTimeout(auto);
      window.clearTimeout(go);
      lights.forEach((id) => window.clearTimeout(id));
    };
  }, [reduce]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finish();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {COPY.crmWinEyebrow}. {companyName} {COPY.crmWinBody}
      </p>
      <motion.div
        aria-hidden
        className={cn(
          "fixed inset-0 flex cursor-pointer flex-col overflow-hidden bg-podium-navy",
          SHELL_Z.celebration,
        )}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
        onClick={finish}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_38%,rgba(34,197,94,0.16),transparent_62%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_20%,rgba(245,179,1,0.14),transparent_58%)]" />

        <div className="podium-checkered relative z-[1] shrink-0" />

        {reduce
          ? null
          : FLAG_PIECES.map((piece) => (
              <FlagPiece key={piece.left} {...piece} />
            ))}

        <div className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <StartingLights litCount={litCount} phase={phase} />
          <p className="mt-6 text-balance text-xs font-bold uppercase tracking-[0.22em] text-podium-success">
            {COPY.crmWinEyebrow}
          </p>
          <motion.p
            className="mt-3 max-w-3xl text-balance font-extrabold leading-[1.05] tracking-tight text-podium-yellow drop-shadow-[0_0_36px_rgba(34,197,94,0.45)]"
            style={{ fontSize: "clamp(1.85rem, 7vw, 3.75rem)" }}
            initial={reduce ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: reduce ? 0 : 0.28, duration: 0.4, ease: EASE }}
          >
            {companyName}
          </motion.p>
          <motion.p
            className="mt-4 max-w-lg text-pretty text-base font-medium text-podium-white md:text-lg"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.45, duration: 0.28, ease: EASE }}
          >
            {COPY.crmWinBody}
          </motion.p>
        </div>

        <div className="podium-checkered relative z-[1] shrink-0" />
      </motion.div>
    </>
  );
}
