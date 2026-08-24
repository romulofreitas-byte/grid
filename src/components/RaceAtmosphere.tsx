"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export function RaceAtmosphere() {
  const reduce = useReducedMotion();
  const [spot, setSpot] = useState({ x: 42, y: 28 });

  useEffect(() => {
    if (reduce) return;
    function onMove(e: PointerEvent) {
      setSpot({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-podium-navy"
    >
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#0b1a2e_0%,#12263f_52%,#0b1a2e_100%)]" />

      <div
        className="absolute inset-0 transition-[background] duration-200"
        style={{
          background: `radial-gradient(ellipse 55% 42% at ${spot.x}% ${spot.y}%, rgba(245,179,1,0.18), transparent 58%)`,
        }}
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,transparent_40%,rgba(11,26,46,0.55)_100%)]"
      />

      <div className="absolute inset-x-0 bottom-[-8%] h-[68%] [perspective:560px]">
        <div
          className={`race-grid h-full w-full origin-bottom opacity-45 ${reduce ? "" : "race-grid-move"}`}
          style={{ transform: "rotateX(68deg) scale(1.18)" }}
        />
      </div>

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-podium-yellow/45 to-transparent" />
    </div>
  );
}
