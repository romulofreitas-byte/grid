"use client";

import {
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const GAP = 6;
const EDGE = 8;

export function placeAnchorPopover(input: {
  anchor: DOMRect;
  panelWidth: number;
  panelHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  align?: "start" | "end";
}): { top: number; left: number } {
  const align = input.align ?? "start";
  const width = Math.max(input.panelWidth, 1);
  const height = Math.max(input.panelHeight, 1);
  let left =
    align === "end" ? input.anchor.right - width : input.anchor.left;
  left = Math.min(
    Math.max(left, EDGE),
    Math.max(EDGE, input.viewportWidth - width - EDGE),
  );
  let top = input.anchor.bottom + GAP;
  if (top + height > input.viewportHeight - EDGE) {
    top = input.anchor.top - GAP - height;
  }
  top = Math.min(
    Math.max(top, EDGE),
    Math.max(EDGE, input.viewportHeight - height - EDGE),
  );
  return { top, left };
}

export function AnchorPopover({
  open,
  anchorRef,
  panelRef,
  id,
  align = "start",
  className,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef?: RefObject<HTMLDivElement | null>;
  id?: string;
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}) {
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const placed = box != null;

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    let ro: ResizeObserver | null = null;
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const panel = panelRef?.current;
      const next = placeAnchorPopover({
        anchor: el.getBoundingClientRect(),
        panelWidth: panel?.offsetWidth ?? 192,
        panelHeight: panel?.offsetHeight ?? 160,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        align,
      });
      setBox((prev) =>
        prev && prev.top === next.top && prev.left === next.left
          ? prev
          : next,
      );
    }
    place();
    const raf = window.requestAnimationFrame(place);
    const panel = panelRef?.current;
    if (panel) {
      ro = new ResizeObserver(place);
      ro.observe(panel);
    }
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, placed, anchorRef, panelRef, align]);

  if (!open || !box) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        zIndex: 80,
      }}
      className={cn(
        "rounded-xl border border-white/10 bg-podium-navy shadow-2xl",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
