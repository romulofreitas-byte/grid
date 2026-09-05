"use client";

import {
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const GAP = 6;
const EDGE = 8;

export const POPOVER_FADE_MS = 120;

export function popoverFadeMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : POPOVER_FADE_MS;
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
  fade = false,
  matchAnchorWidth = false,
  className,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef?: RefObject<HTMLDivElement | null>;
  id?: string;
  align?: "start" | "end";
  fade?: boolean;
  matchAnchorWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width?: number;
  } | null>(null);
  const [shown, setShown] = useState(false);
  const [opaque, setOpaque] = useState(false);
  const placed = box != null;

  useEffect(() => {
    if (open) {
      setShown(true);
      return;
    }
    const ms = fade ? popoverFadeMs(reducedMotion()) : 0;
    if (ms <= 0) {
      setShown(false);
      setOpaque(false);
      setBox(null);
      return;
    }
    setOpaque(false);
    const t = window.setTimeout(() => {
      setShown(false);
      setBox(null);
    }, ms);
    return () => window.clearTimeout(t);
  }, [open, fade]);

  useLayoutEffect(() => {
    if (!open) return;
    let ro: ResizeObserver | null = null;
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const panel = panelRef?.current;
      const anchor = el.getBoundingClientRect();
      const next = placeAnchorPopover({
        anchor,
        panelWidth: matchAnchorWidth
          ? anchor.width
          : (panel?.offsetWidth ?? 192),
        panelHeight: panel?.offsetHeight ?? 160,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        align,
      });
      const width = matchAnchorWidth ? anchor.width : undefined;
      setBox((prev) =>
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === width
          ? prev
          : { ...next, width },
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
  }, [open, placed, anchorRef, panelRef, align, matchAnchorWidth]);

  useLayoutEffect(() => {
    if (!open || !placed) return;
    const ms = fade ? popoverFadeMs(reducedMotion()) : 0;
    if (ms <= 0) {
      setOpaque(true);
      return;
    }
    setOpaque(false);
    const raf = window.requestAnimationFrame(() => setOpaque(true));
    return () => window.cancelAnimationFrame(raf);
  }, [open, placed, fade]);

  if (!box) return null;
  if (!open && (!fade || !shown)) return null;

  const ms = fade ? popoverFadeMs(reducedMotion()) : 0;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      data-anchor-popover=""
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        zIndex: 80,
        width: box.width,
        opacity: !fade || opaque ? 1 : 0,
        transition:
          fade && ms > 0 ? `opacity ${POPOVER_FADE_MS}ms ease-out` : undefined,
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
