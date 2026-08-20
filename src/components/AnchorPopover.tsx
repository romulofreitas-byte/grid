"use client";

import {
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

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

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox({
        top: r.bottom + 6,
        left: align === "end" ? r.right : r.left,
      });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, align]);

  if (!open || !box) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        transform: align === "end" ? "translateX(-100%)" : undefined,
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
