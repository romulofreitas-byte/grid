import type { TourPlacement } from "./steps";

export type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type Viewport = { width: number; height: number };

export type TooltipSize = { width: number; height: number };

export type TooltipLayout = {
  top: number;
  left: number;
  placement: TourPlacement;
  arrowLeft: number;
  arrowTop: number;
};

const GAP = 14;
const PAD = 12;
const ARROW = 8;

const ORDER: Record<TourPlacement, TourPlacement[]> = {
  bottom: ["bottom", "top", "right", "left"],
  top: ["top", "bottom", "right", "left"],
  right: ["right", "left", "bottom", "top"],
  left: ["left", "right", "bottom", "top"],
};

function fits(pos: { top: number; left: number }, size: TooltipSize, vp: Viewport) {
  return (
    pos.top >= PAD &&
    pos.left >= PAD &&
    pos.top + size.height <= vp.height - PAD &&
    pos.left + size.width <= vp.width - PAD
  );
}

function rawPlace(
  target: Rect,
  size: TooltipSize,
  placement: TourPlacement,
): { top: number; left: number } {
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  switch (placement) {
    case "bottom":
      return { top: target.top + target.height + GAP, left: cx - size.width / 2 };
    case "top":
      return { top: target.top - size.height - GAP, left: cx - size.width / 2 };
    case "right":
      return { top: cy - size.height / 2, left: target.left + target.width + GAP };
    case "left":
      return { top: cy - size.height / 2, left: target.left - size.width - GAP };
  }
}

function clamp(pos: { top: number; left: number }, size: TooltipSize, vp: Viewport) {
  return {
    top: Math.min(
      Math.max(PAD, pos.top),
      Math.max(PAD, vp.height - size.height - PAD),
    ),
    left: Math.min(
      Math.max(PAD, pos.left),
      Math.max(PAD, vp.width - size.width - PAD),
    ),
  };
}

function arrowFor(
  target: Rect,
  tooltip: { top: number; left: number },
  size: TooltipSize,
  placement: TourPlacement,
): { arrowLeft: number; arrowTop: number } {
  const cx = target.left + target.width / 2 - tooltip.left;
  const cy = target.top + target.height / 2 - tooltip.top;
  const minX = 18;
  const maxX = size.width - 18;
  const minY = 18;
  const maxY = size.height - 18;
  if (placement === "bottom" || placement === "top") {
    return {
      arrowLeft: Math.min(maxX, Math.max(minX, cx)),
      arrowTop: placement === "bottom" ? -ARROW : size.height,
    };
  }
  return {
    arrowLeft: placement === "right" ? -ARROW : size.width,
    arrowTop: Math.min(maxY, Math.max(minY, cy)),
  };
}

export function placeTooltip(
  target: Rect,
  size: TooltipSize,
  preferred: TourPlacement,
  viewport: Viewport,
): TooltipLayout {
  for (const placement of ORDER[preferred]) {
    const raw = rawPlace(target, size, placement);
    if (fits(raw, size, viewport)) {
      return {
        ...raw,
        placement,
        ...arrowFor(target, raw, size, placement),
      };
    }
  }
  const placement = preferred;
  const clamped = clamp(rawPlace(target, size, placement), size, viewport);
  return {
    ...clamped,
    placement,
    ...arrowFor(target, clamped, size, placement),
  };
}

export function inflateRect(rect: Rect, pad: number): Rect {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function clampRectToViewport(
  rect: Rect,
  viewport: Viewport,
  inset = 0,
): Rect {
  const left = Math.max(rect.left, inset);
  const top = Math.max(rect.top, inset);
  const right = Math.min(rect.left + rect.width, viewport.width - inset);
  const bottom = Math.min(rect.top + rect.height, viewport.height - inset);
  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}
