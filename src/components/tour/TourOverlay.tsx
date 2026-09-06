"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { COPY } from "@/lib/copy";
import {
  clampRectToViewport,
  inflateRect,
  isLastTourStep,
  placeTooltip,
  TOUR_STEP_COUNT,
  type TourStep,
} from "@/lib/tour";
import { cn } from "@/lib/utils";

function visibleTourTarget(id: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return node;
  }
  return nodes[0] ?? null;
}

export function TourOverlay({
  step,
  index,
  finishLabel,
  onNext,
  onBack,
  onSkip,
}: {
  step: TourStep;
  index: number;
  finishLabel: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [bubble, setBubble] = useState<{
    top: number;
    left: number;
    placement: TourStep["placement"];
    arrowLeft: number;
    arrowTop: number;
  } | null>(null);

  useLayoutEffect(() => {
    let frame = 0;
    let tries = 0;
    let observed: HTMLElement | null = null;
    const observer = new ResizeObserver(() => {
      tries = 0;
      measure();
    });

    function measure() {
      const target = visibleTourTarget(step.target);
      const bubbleEl = bubbleRef.current;
      if (!target || !bubbleEl) {
        if (tries < 12) {
          tries += 1;
          frame = requestAnimationFrame(measure);
        }
        return;
      }
      if (observed !== target) {
        if (observed) observer.disconnect();
        observer.observe(target);
        observed = target;
      }
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const before = target.getBoundingClientRect();
      const coversViewport =
        before.top <= 8 &&
        before.left <= 8 &&
        before.bottom >= viewport.height - 8 &&
        before.right >= viewport.width - 8;
      if (!coversViewport) {
        target.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "auto",
        });
      }
      const rect = target.getBoundingClientRect();
      setHighlight(clampRectToViewport(inflateRect(rect, 6), viewport));
      const size = {
        width: bubbleEl.offsetWidth,
        height: bubbleEl.offsetHeight,
      };
      setBubble(placeTooltip(rect, size, step.placement, viewport));
    }

    measure();
    const onWin = () => {
      tries = 0;
      measure();
    };
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [step]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const last = isLastTourStep(index);
  const counter = COPY.tourCounter
    .replace("{n}", String(index + 1))
    .replace("{total}", String(TOUR_STEP_COUNT));

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={step.title}>
      <div className="absolute inset-0 bg-transparent" />
      {highlight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl ring-2 ring-podium-yellow shadow-[0_0_0_6px_rgba(245,179,1,0.16)]"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      ) : null}

      <div
        ref={bubbleRef}
        className="absolute z-[80] w-[min(20.5rem,calc(100vw-1.5rem))] rounded-lg border border-white/[0.08] bg-[rgba(12,22,42,0.72)] p-4 text-podium-white backdrop-blur-xl"
        style={
          bubble
            ? { top: bubble.top, left: bubble.left }
            : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
        }
        onClick={(event) => event.stopPropagation()}
      >
        {bubble ? (
          <span
            aria-hidden
            className={cn(
              "absolute h-0 w-0 border-8 border-transparent",
              bubble.placement === "bottom" && "border-b-white/15",
              bubble.placement === "top" && "border-t-white/15",
              bubble.placement === "right" && "border-r-white/15",
              bubble.placement === "left" && "border-l-white/15",
            )}
            style={
              bubble.placement === "bottom"
                ? { left: bubble.arrowLeft - 8, top: -16 }
                : bubble.placement === "top"
                  ? { left: bubble.arrowLeft - 8, top: "100%" }
                  : bubble.placement === "right"
                    ? { left: -16, top: bubble.arrowTop - 8 }
                    : { left: "100%", top: bubble.arrowTop - 8 }
            }
          />
        ) : null}

        <button
          type="button"
          onClick={onSkip}
          className="absolute right-3 top-3 text-[11px] font-semibold text-white/55 transition hover:text-white"
        >
          {COPY.tourSkip}
        </button>

        <p className="pr-12 text-sm font-bold leading-snug">{step.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{step.body}</p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={index === 0}
            aria-label={COPY.tourBack}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 disabled:opacity-25"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="flex-1 text-center text-xs font-semibold tabular-nums text-white/70">
            {counter}
          </span>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-podium-yellow px-3.5 py-1.5 text-xs font-bold text-podium-navy transition hover:brightness-110"
          >
            {last ? finishLabel : COPY.tourNext}
          </button>
        </div>
      </div>
    </div>
  );
}
