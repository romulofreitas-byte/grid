"use client";

import { COPY } from "@/lib/copy";
import type { CrmStage } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

const VISIBLE_STAGES = 5;

export function CrmStageChevronBar({
  stages,
  activeId,
  onSelect,
}: {
  stages: CrmStage[];
  activeId: string;
  onSelect: (stageId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const overflowing = stages.length > VISIBLE_STAGES;

  function updateOverflow() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft < max - 1);
  }

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    const ro = new ResizeObserver(updateOverflow);
    ro.observe(el);
    el.addEventListener("scroll", updateOverflow, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateOverflow);
    };
  }, [stages]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const active = scroller.querySelector(
      `[data-stage-id="${CSS.escape(activeId)}"]`,
    );
    if (!(active instanceof HTMLElement)) return;
    const left =
      active.getBoundingClientRect().left -
      scroller.getBoundingClientRect().left +
      scroller.scrollLeft;
    scroller.scrollTo({
      left: left - (scroller.clientWidth - active.offsetWidth) / 2,
      behavior: "auto",
    });
    updateOverflow();
  }, [activeId]);

  function scroll(delta: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const step = el.clientWidth / VISIBLE_STAGES;
    el.scrollBy({ left: delta * step, behavior: "smooth" });
  }

  const visible = Math.min(VISIBLE_STAGES, Math.max(stages.length, 1));
  const trackWidth = `${(stages.length / visible) * 100}%`;
  const itemWidth = `${100 / Math.max(stages.length, 1)}%`;

  const arrowClass =
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:pointer-events-none disabled:opacity-30";

  return (
    <>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1.5 md:hidden">
        {stages.map((stage) => {
          const active = stage.id === activeId;
          return (
            <button
              key={stage.id}
              type="button"
              title={stage.nome}
              onClick={() => {
                if (!active) onSelect(stage.id);
              }}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium leading-tight",
                active
                  ? "bg-podium-yellow text-podium-navy"
                  : "bg-zinc-100 text-zinc-500",
              )}
            >
              {stage.nome}
            </button>
          );
        })}
      </div>
      <div className="hidden shrink-0 items-center gap-1 border-b border-zinc-200 bg-white px-2 py-1.5 md:flex">
      {overflowing ? (
        <button
          type="button"
          aria-label={COPY.crmPrevStages}
          disabled={!canPrev}
          onClick={() => scroll(-1)}
          className={arrowClass}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <div ref={scrollerRef} className="min-w-0 flex-1 overflow-hidden">
        <div className="flex" style={{ width: trackWidth }}>
          {stages.map((stage, index) => {
            const active = stage.id === activeId;
            return (
              <button
                key={stage.id}
                type="button"
                data-stage-id={stage.id}
                title={stage.nome}
                onClick={() => {
                  if (!active) onSelect(stage.id);
                }}
                className={cn(
                  "relative shrink-0 truncate px-3 py-1 text-left text-[10px] font-medium leading-tight transition",
                  active
                    ? "bg-podium-yellow text-podium-navy"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800",
                )}
                style={{
                  flex: `0 0 ${itemWidth}`,
                  width: itemWidth,
                  clipPath:
                    index === 0
                      ? "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)"
                      : "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)",
                  marginLeft: index === 0 ? 0 : -6,
                  paddingLeft: index === 0 ? 10 : 14,
                }}
              >
                {stage.nome}
              </button>
            );
          })}
        </div>
      </div>
      {overflowing ? (
        <button
          type="button"
          aria-label={COPY.crmNextStages}
          disabled={!canNext}
          onClick={() => scroll(1)}
          className={arrowClass}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
      </div>
    </>
  );
}
