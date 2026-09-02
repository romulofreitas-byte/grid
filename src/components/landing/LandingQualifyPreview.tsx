"use client";

import {
  LANDING_QUALIFY_SCENES,
  type LandingQualifyAsset,
  type LandingQualifyScene,
} from "@/components/landing/demo-leads";
import { COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const ROW_START_MS = 420;
const ROW_STEP_MS = 280;
const HOLD_QUALIFIED_MS = 1600;
const HOLD_OPPORTUNITY_MS = 2500;
const EASE = [0.16, 1, 0.3, 1] as const;

function AssetSeal({ asset }: { asset: LandingQualifyAsset }) {
  if (asset.missing) {
    return (
      <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300">
        {COPY.landingQualifyMissingSeal}
      </span>
    );
  }
  if (!asset.seal) return null;
  return (
    <span className="shrink-0 rounded-full bg-podium-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-podium-success">
      {asset.seal}
    </span>
  );
}

function SceneCard({
  scene,
  shown,
  reduce,
}: {
  scene: LandingQualifyScene;
  shown: number;
  reduce: boolean;
}) {
  const scanning = !reduce && shown < scene.assets.length;
  const status =
    scanning
      ? { text: "Qualificando", className: "text-podium-yellow" }
      : scene.id === "opportunity"
        ? { text: COPY.landingQualifyOpportunity, className: "text-amber-300" }
        : { text: "Qualificada", className: "text-podium-success" };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-podium-muted">
            {COPY.landingQualifyPreviewLabel}
          </p>
          <p className="mt-2 truncate font-bold text-podium-white">
            {scene.empresa}
          </p>
          <p className="text-xs text-podium-muted">{scene.cidade}</p>
        </div>
        <span
          className={cn(
            "shrink-0 text-[10px] font-bold uppercase tracking-[0.14em]",
            status.className,
          )}
        >
          {status.text}
        </span>
      </div>

      <ul className="mt-5 space-y-2">
        {scene.assets.map((asset, i) => {
          const on = i < shown;
          return (
            <motion.li
              key={asset.label}
              initial={false}
              animate={
                on
                  ? { opacity: 1, y: 0 }
                  : { opacity: reduce ? 1 : 0.25, y: reduce ? 0 : 6 }
              }
              transition={{ duration: 0.3, ease: EASE }}
              className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-podium-muted">
                  {asset.label}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-podium-white">
                  {on ? asset.value : "—"}
                </p>
              </div>
              {on ? (
                <AssetSeal asset={asset} />
              ) : (
                <span className="h-4 w-16 animate-pulse rounded-full bg-white/10" />
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

export function LandingQualifyPreview({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { once: true, margin: "-80px" });
  const opportunity = LANDING_QUALIFY_SCENES[1];
  const [sceneIndex, setSceneIndex] = useState(reduce ? 1 : 0);
  const [shown, setShown] = useState(
    reduce ? opportunity.assets.length : 0,
  );

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setSceneIndex(1);
      setShown(opportunity.assets.length);
      return;
    }

    let cancelled = false;
    let index = 0;
    const ids: number[] = [];
    const later = (ms: number, fn: () => void) => {
      ids.push(window.setTimeout(fn, ms));
    };

    const play = () => {
      if (cancelled) return;
      const scene = LANDING_QUALIFY_SCENES[index];
      setSceneIndex(index);
      setShown(0);
      scene.assets.forEach((_, i) => {
        later(ROW_START_MS + i * ROW_STEP_MS, () => {
          if (!cancelled) setShown(i + 1);
        });
      });
      const hold = index === 0 ? HOLD_QUALIFIED_MS : HOLD_OPPORTUNITY_MS;
      later(
        ROW_START_MS + (scene.assets.length - 1) * ROW_STEP_MS + hold,
        () => {
          if (cancelled) return;
          index = index === 0 ? 1 : 0;
          play();
        },
      );
    };

    play();
    return () => {
      cancelled = true;
      for (const id of ids) window.clearTimeout(id);
    };
  }, [inView, reduce, opportunity.assets.length]);

  const scene = LANDING_QUALIFY_SCENES[sceneIndex];

  return (
    <div
      ref={root}
      className={cn(
        "relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-podium-panel/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md",
        className,
      )}
      role="region"
      aria-label={COPY.landingQualifyPreviewLabel}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={scene.id}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            reduce
              ? undefined
              : {
                  opacity: 0,
                  y: -8,
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                }
          }
          transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
        >
          <SceneCard scene={scene} shown={shown} reduce={Boolean(reduce)} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
