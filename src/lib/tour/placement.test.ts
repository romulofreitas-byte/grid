import { describe, expect, it } from "vitest";
import { inflateRect, placeTooltip } from "./placement";

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
