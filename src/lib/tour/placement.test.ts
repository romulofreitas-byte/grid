import { describe, expect, it } from "vitest";
import { clampRectToViewport, inflateRect, placeTooltip } from "./placement";

const size = { width: 320, height: 160 };
const viewport = { width: 1280, height: 800 };

describe("placeTooltip", () => {
  it("puts the bubble below when there is room", () => {
    const layout = placeTooltip(
      { top: 80, left: 400, width: 120, height: 40 },
      size,
      "bottom",
      viewport,
    );
    expect(layout.placement).toBe("bottom");
    expect(layout.top).toBe(80 + 40 + 14);
    expect(layout.left).toBe(400 + 60 - 160);
  });

  it("flips above when the preferred side overflows", () => {
    const layout = placeTooltip(
      { top: 700, left: 400, width: 120, height: 40 },
      size,
      "bottom",
      viewport,
    );
    expect(layout.placement).toBe("top");
    expect(layout.top + size.height).toBeLessThanOrEqual(700);
  });

  it("keeps the bubble inside a narrow viewport", () => {
    const layout = placeTooltip(
      { top: 20, left: 0, width: 40, height: 24 },
      size,
      "bottom",
      { width: 360, height: 640 },
    );
    expect(layout.left).toBeGreaterThanOrEqual(12);
    expect(layout.left + size.width).toBeLessThanOrEqual(360 - 12);
  });
});

describe("inflateRect", () => {
  it("pads the highlight without shifting the center", () => {
    expect(inflateRect({ top: 10, left: 20, width: 100, height: 50 }, 6)).toEqual({
      top: 4,
      left: 14,
      width: 112,
      height: 62,
    });
  });
});

describe("clampRectToViewport", () => {
  it("clips a highlight that overflows the viewport", () => {
    expect(
      clampRectToViewport(
        { top: -12, left: 40, width: 1400, height: 900 },
        viewport,
      ),
    ).toEqual({
      top: 0,
      left: 40,
      width: 1240,
      height: 800,
    });
  });

  it("keeps an inset so the ring does not sit under chrome", () => {
    expect(
      clampRectToViewport(
        { top: -4, left: -4, width: 200, height: 80 },
        { width: 360, height: 640 },
        8,
      ),
    ).toEqual({
      top: 8,
      left: 8,
      width: 188,
      height: 68,
    });
  });
});

describe("placeTooltip on a large target", () => {
  it("keeps the bubble inside the viewport when the target fills the page", () => {
    const layout = placeTooltip(
      { top: 56, left: 88, width: 1100, height: 720 },
      size,
      "bottom",
      viewport,
    );
    expect(layout.top).toBeGreaterThanOrEqual(12);
    expect(layout.left).toBeGreaterThanOrEqual(12);
    expect(layout.top + size.height).toBeLessThanOrEqual(viewport.height - 12);
    expect(layout.left + size.width).toBeLessThanOrEqual(viewport.width - 12);
  });
});
