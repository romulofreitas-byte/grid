import { describe, expect, it } from "vitest";
import { placeAnchorPopover, popoverFadeMs, POPOVER_FADE_MS } from "./AnchorPopover";

describe("placeAnchorPopover", () => {
  const anchor = {
    top: 500,
    bottom: 536,
    left: 200,
    right: 236,
    width: 36,
    height: 36,
    x: 200,
    y: 500,
    toJSON() {
      return this;
    },
  } satisfies DOMRect;

  it("opens below when there is room", () => {
    expect(
      placeAnchorPopover({
        anchor,
        panelWidth: 192,
        panelHeight: 120,
        viewportWidth: 800,
        viewportHeight: 800,
        align: "end",
      }),
    ).toEqual({ top: 542, left: 44 });
  });

  it("flips above when the panel would leave the viewport", () => {
    expect(
      placeAnchorPopover({
        anchor,
        panelWidth: 192,
        panelHeight: 160,
        viewportWidth: 800,
        viewportHeight: 560,
        align: "end",
      }),
    ).toEqual({ top: 334, left: 44 });
  });
});

describe("popoverFadeMs", () => {
  it("holds the panel for the fade duration", () => {
    expect(popoverFadeMs(false)).toBe(POPOVER_FADE_MS);
  });

  it("unmounts immediately when motion is reduced", () => {
    expect(popoverFadeMs(true)).toBe(0);
  });
});
